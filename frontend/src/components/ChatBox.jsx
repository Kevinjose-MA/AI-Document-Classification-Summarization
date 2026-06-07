import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

export default function ChatBox({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
      const res = await api.post(`/documents/chat`, {
        document_ids: [documentId],
        questions: [q],
        include_ocr: true,
        top_k: 5,
      });
      const answer = res.data.answers?.[0] || "No answer returned.";
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err.message || "Request failed.";
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${errMsg}` }]);
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
        {messages.map((m, i) => (
          <div key={i} className={`max-w-full ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`${m.role === 'user' ? 'inline-block bg-blue-600 text-white' : 'inline-block bg-gray-50 text-gray-800'} px-3 py-2 rounded-lg`}>
              <div className="whitespace-pre-wrap text-sm">{m.text}</div>
            </div>
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
