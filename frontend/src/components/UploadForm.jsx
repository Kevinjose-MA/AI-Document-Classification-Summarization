// components/UploadForm.jsx
import { useState, useRef, useCallback } from "react";
import api from "../api/axios";
import { useToast } from "./Toast";

export default function UploadForm({ onUpload }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  const ACCEPTED = ".pdf,.doc,.docx,.txt,.eml,.png,.jpg,.jpeg";

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const handleUpload = async () => {
    if (!file || loading) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await api.post("/documents/upload", formData);
      setFile(null);
      toast("Document uploaded successfully", "success");
      if (onUpload) onUpload();
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data?.detail;
        toast(`Already uploaded: ${data?.filename || "this file"}`, "warning");
      } else {
        toast("Upload failed. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
          ${isDragging
            ? "border-blue-400 bg-blue-50 scale-[1.01]"
            : file
            ? "border-emerald-300 bg-emerald-50"
            : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {file ? (
          <div className="space-y-1">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-400">{formatSize(file.size)} · Click to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop your file here, or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, EML, PNG, JPG</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200
          ${loading || !file
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-sm"
          }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Uploading...
          </span>
        ) : "Upload Document"}
      </button>
    </div>
  );
}