import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

export default function ChatBox({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState({});
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || !documentId) return;
    const userMsg = { role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build conversation history for context (exclude current message)
      const conversationHistory = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await api.post(`/documents/chat`, {
        document_ids: [documentId],
        questions: [q],
        conversation_history: conversationHistory,
        include_ocr: true,
        top_k: 5,
      });
      const answer = res.data.answers?.[0] || "No answer returned.";
      const citations = res.data.citations?.[0] || [];
      setMessages((m) => [...m, { role: "assistant", text: answer, citations }]);
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err.message || "Request failed.";
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${errMsg}`, citations: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggleCitation = (msgIndex, citIndex) => {
    const key = `${msgIndex}-${citIndex}`;
    setExpandedCitations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-[60vh] max-h-[60vh] border border-gray-100 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Document Chat</div>
        <div className="text-xs text-gray-400">AI-powered Q&A</div>
      </div>

      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400">
            {documentId
              ? "Ask a question about this document to get started."
              : "Open a document to start a document-specific conversation."
            }
          </div>
        )}
        {messages.map((m, msgIndex) => (
          <div key={msgIndex} className={`max-w-full ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`${m.role === 'user' ? 'inline-block bg-blue-600 text-white' : 'inline-block bg-gray-50 text-gray-800'} px-3 py-2 rounded-lg`}>
              <div className="whitespace-pre-wrap text-sm">{m.text}</div>
            </div>
            
            {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
              <div className="mt-2 space-y-1">
                {m.citations.map((cit, citIndex) => {
                  const citKey = `${msgIndex}-${citIndex}`;
                  const isExpanded = expandedCitations[citKey];
                  const sourceLabel = cit.source_kind === 'ocr_text' ? 'OCR' : cit.source_kind === 'clause' ? 'Clause' : 'Summary';
                  
                  return (
                    <div
                      key={citIndex}
                      className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1.5 cursor-pointer hover:bg-blue-100 transition"
                      onClick={() => toggleCitation(msgIndex, citIndex)}
                    >
                      <div className="font-semibold text-blue-900">
                        📄 {cit.filename} <span className="text-xs text-blue-700">({sourceLabel})</span>
                      </div>
                      {isExpanded && (
                        <div className="mt-1 text-gray-700 border-t border-blue-200 pt-1 max-h-20 overflow-y-auto">
                          {cit.text_snippet}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
            placeholder={documentId ? "Ask about this document..." : "Open a document to use chat."} rows={1}
            disabled={!documentId}
            className="flex-1 resize-none text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100" />
          <button onClick={send} disabled={loading || !documentId}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
