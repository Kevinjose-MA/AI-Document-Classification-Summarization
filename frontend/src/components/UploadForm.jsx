// src/components/UploadForm.jsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "./Toast";

const ACCEPTED = ".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.csv,.txt";
const MAX_MB   = 50;

function FileBadge({ filename }) {
  const ext = (filename?.split(".").pop() || "").toLowerCase();
  const map = {
    pdf:"bg-red-100 text-red-700", docx:"bg-blue-100 text-blue-700",
    doc:"bg-blue-100 text-blue-700", xlsx:"bg-emerald-100 text-emerald-700",
    xls:"bg-emerald-100 text-emerald-700", png:"bg-purple-100 text-purple-700",
    jpg:"bg-purple-100 text-purple-700", jpeg:"bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase font-mono ${map[ext] || "bg-gray-100 text-gray-500"}`}>
      {ext || "—"}
    </span>
  );
}

export default function UploadForm({ onUpload }) {
  const navigate  = useNavigate();
  const toast     = useToast();
  const inputRef  = useRef(null);

  const [file,       setFile]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [duplicate,  setDuplicate]  = useState(null); // { document_id, filename, department }
  const [result,     setResult]     = useState(null); // successful upload result

  const pickFile = (f) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast(`File too large. Maximum size is ${MAX_MB}MB.`, "error");
      return;
    }
    setFile(f);
    setDuplicate(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file || loading) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      setLoading(true);
      setDuplicate(null);
      const res = await api.post("/documents/upload", fd);
      setResult(res.data);
      setFile(null);
      toast("Document uploaded and queued for processing", "success");
      if (onUpload) onUpload();
    } catch (err) {
      if (err.response?.status === 409) {
        // Org-wide duplicate — show inline message with link to existing doc
        const d = err.response.data?.detail || err.response.data;
        setDuplicate(d);
        setFile(null);
      } else {
        toast(err.response?.data?.detail || "Upload failed. Please try again.", "error");
      }
    } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setDuplicate(null); setResult(null); };

  return (
    <div className="space-y-4">

      {/* ── Success state ── */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 fade-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-emerald-600">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Document uploaded successfully</p>
              <p className="text-xs text-emerald-700 mt-0.5 font-mono truncate">{result.filename}</p>
              <p className="text-xs text-emerald-600 mt-1">
                Routed to <span className="font-semibold capitalize">{result.department || "General"}</span>
                {" · "}sensitivity: <span className="font-semibold capitalize">{result.sensitivity || "medium"}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigate(`/documents/${result.document_id}`)}
              className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer active:scale-95">
              View Document →
            </button>
            <button onClick={reset}
              className="flex-1 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition cursor-pointer">
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* ── Duplicate state ── */}
      {duplicate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 fade-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-600">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">This document already exists</p>
              <p className="text-xs text-amber-700 mt-0.5 font-mono truncate">{duplicate.filename}</p>
              {duplicate.department && (
                <p className="text-xs text-amber-600 mt-1">
                  Already in <span className="font-semibold capitalize">{duplicate.department}</span> department
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigate(`/documents/${duplicate.document_id}`)}
              className="flex-1 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition cursor-pointer active:scale-95">
              View Existing →
            </button>
            <button onClick={reset}
              className="flex-1 py-2 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition cursor-pointer">
              Upload Different File
            </button>
          </div>
        </div>
      )}

      {/* ── Drop zone ── */}
      {!result && !duplicate && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragging  ? "border-blue-400 bg-blue-50" :
                file      ? "border-emerald-300 bg-emerald-50" :
                            "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40"}`}>
            <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden"
              onChange={e => pickFile(e.target.files[0])} />

            {file ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <FileBadge filename={file.name} />
                  <p className="text-sm font-semibold text-emerald-700 truncate max-w-[280px]">{file.name}</p>
                </div>
                <p className="text-xs text-emerald-600 font-mono">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload
                </p>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition cursor-pointer underline">
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-gray-400">
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Drop your document here</p>
                  <p className="text-xs text-gray-400 mt-0.5">or click to browse · max {MAX_MB}MB</p>
                </div>
                <p className="text-[11px] font-mono text-gray-400">{ACCEPTED}</p>
              </div>
            )}
          </div>

          <button onClick={handleUpload} disabled={!file || loading}
            className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Processing…
              </span>
            ) : "Upload & Process"}
          </button>
        </>
      )}
    </div>
  );
}