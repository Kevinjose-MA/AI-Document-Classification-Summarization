// pages/UploadPage.jsx
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../components/Toast";

const ACCEPTED = ".pdf,.doc,.docx,.txt,.eml,.png,.jpg,.jpeg";

export default function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);

  const pickFile = f => { if (f) { setFile(f); setResult(null); } };

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }, []);

  const handleUpload = async () => {
    if (!file || loading) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      setLoading(true);
      const res = await api.post("/documents/upload", fd);
      setResult(res.data);
      setFile(null);
      toast("Document ingested and queued for AI processing", "success");
    } catch (err) {
      if (err.response?.status === 409) {
        toast(`Already ingested: ${err.response.data?.detail?.filename || "this file"}`, "warning");
      } else {
        toast("Ingestion failed. Please try again.", "error");
      }
    } finally { setLoading(false); }
  };

  const fmt = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="fade-up d1">
        <h1 className="text-[22px] font-semibold text-[#0D1525] tracking-tight">Ingest Document</h1>
        <p className="text-[12px] text-[#8896A8] mt-1 font-mono">
          Upload documents for AI-powered OCR, classification, summarization, and department routing.
        </p>
      </div>

      {/* Upload panel */}
      <div className="fade-up d2 panel p-5 space-y-4">

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 select-none
            ${dragging ? "border-[#00C2D4] bg-[#00C2D4]/5 scale-[1.01]"
            : file    ? "border-emerald-300 bg-emerald-50/50"
            :           "border-[#DDE3EE] bg-[#F8FAFD] hover:border-[#00C2D4]/50 hover:bg-[#00C2D4]/2"}`}>

          <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden"
            onChange={e => pickFile(e.target.files?.[0])} />

          {file ? (
            <div className="space-y-2.5">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-emerald-600">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-[#0D1525]">{file.name}</p>
              <p className="text-[12px] text-[#8896A8] font-mono">{fmt(file.size)} · click to change file</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-[#F0F4FA] rounded-2xl flex items-center justify-center mx-auto border border-[#DDE3EE]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-[#8896A8]">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#4A5568]">
                  Drop document here or <span className="text-[#00C2D4]">browse files</span>
                </p>
                <p className="text-[11px] text-[#8896A8] mt-1 font-mono">PDF · DOCX · TXT · EML · PNG · JPG</p>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleUpload} disabled={!file || loading}
          className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
            ${!file || loading
              ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
              : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] shadow-sm"}`}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Ingesting & queuing AI pipeline…
            </span>
          ) : "Ingest Document"}
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div className="fade-up panel border-emerald-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-[#0D1525]">Ingestion complete</p>
            <span className="ml-auto text-[11px] font-mono text-[#8896A8]">ID: {result.document_id?.slice(-8)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["Filename",    result.filename],
              ["Routed to",   result.department],
              ["Sensitivity", result.sensitivity],
              ["Status",      "AI Processing…"],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#F8FAFD] border border-[#EEF2F8] rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-mono text-[#8896A8] uppercase tracking-wider">{k}</p>
                <p className="text-[13px] font-medium text-[#0D1525] mt-0.5 capitalize truncate">{v || "—"}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => navigate(`/documents/${result.document_id}`)}
              className="flex-1 py-2 text-[13px] font-medium text-white bg-[#00C2D4] hover:bg-[#0096A6] rounded-xl transition">
              View AI Analysis →
            </button>
            <button onClick={() => setResult(null)}
              className="px-4 py-2 text-[13px] font-medium text-[#4A5568] bg-[#F0F4FA] hover:bg-[#E8EDF5] rounded-xl transition">
              Ingest another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}