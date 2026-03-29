// src/pages/DocumentViewer.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { API_BASE } from "../api/axios";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

// ── Dept color config ────────────────────────────────────
const DEPT_CFG = {
  engineering: { color: "text-blue-600",    bg: "bg-blue-50"    },
  finance:     { color: "text-emerald-600", bg: "bg-emerald-50" },
  legal:       { color: "text-violet-600",  bg: "bg-violet-50"  },
  hr:          { color: "text-pink-600",    bg: "bg-pink-50"    },
  operations:  { color: "text-orange-600",  bg: "bg-orange-50"  },
  compliance:  { color: "text-red-600",     bg: "bg-red-50"     },
  general:     { color: "text-slate-600",   bg: "bg-slate-50"   },
};
const getDept = (k) => DEPT_CFG[(k || "general").toLowerCase()] || DEPT_CFG.general;

// ── AI confidence ring ────────────────────────────────────
function ConfidenceRing({ score }) {
  const pct  = Math.round((score || 0.75) * 100);
  const circ = 2 * Math.PI * 18;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#EEF2F8" strokeWidth="3" />
          <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono" style={{ color }}>
          {pct}
        </span>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-800">AI Confidence</p>
        <p className="text-[10px] text-gray-500 font-mono">{pct >= 80 ? "High" : pct >= 60 ? "Medium" : "Low"}</p>
      </div>
    </div>
  );
}

// ── Password prompt modal (for locked/encrypted docs) ─────
function PasswordModal({ filename, onSubmit, onClose, loading, error }) {
  const [pwd, setPwd] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm p-6 fade-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-slate-600">
              <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Password Required</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{filename}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This document is encrypted. Enter the password to download it.
        </p>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <input
          type="password"
          placeholder="Document password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pwd && onSubmit(pwd)}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition mb-4"
        />

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">
            Cancel
          </button>
          <button onClick={() => pwd && onSubmit(pwd)} disabled={!pwd || loading}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 cursor-pointer">
            {loading ? "Downloading…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Acknowledge banner (for review docs) ──────────────────
function ReviewBanner({ docId, onAcknowledged }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const acknowledge = async () => {
    try {
      setLoading(true);
      await api.patch(`/documents/${docId}`, { routing_status: "ready" });
      toast("Document marked as reviewed", "success");
      onAcknowledged();
    } catch {
      toast("Failed to update document status", "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 fade-up">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-600 shrink-0">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">This document needs review</p>
          <p className="text-xs text-amber-700 mt-0.5">Please review and acknowledge once confirmed.</p>
        </div>
      </div>
      <button onClick={acknowledge} disabled={loading}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg transition disabled:opacity-50 cursor-pointer">
        {loading ? "Saving…" : (
          <>
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
              <path d="M10.28 2.28a.75.75 0 0 0-1.06 0L4.5 7 2.78 5.28a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5.5-5.5a.75.75 0 0 0 0-1.06Z" />
            </svg>
            Mark as Reviewed
          </>
        )}
      </button>
    </div>
  );
}

// ══════════ MAIN ══════════════════════════════════════════
export default function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [doc, setDoc]                   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [activeTab, setActiveTab]       = useState("summary");
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdLoading, setPwdLoading]     = useState(false);
  const [pwdError, setPwdError]         = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchDoc = () => {
    api.get(`/documents/${id}`)
      .then((r) => setDoc(r.data))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await api.get(`/documents/${id}/preview`, {
          responseType: "blob",
        });
        const url = URL.createObjectURL(res.data);
        setPreviewUrl(url);
      } catch {
        setPreviewError(true);
      }
    };

    fetchDoc();
    fetchPreview();

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [id]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/documents/${id}`);
      toast("Document deleted successfully", "success");
      navigate("/documents");
    } catch { toast("Failed to delete document", "error"); }
    finally { setDeleting(false); setConfirmOpen(false); }
  };

  // Regular download
  const handleDownload = () => {
    if (doc?.encrypted_external || doc?.routing_status?.toLowerCase() === "locked") {
      setShowPwdModal(true);
    } else {
      window.open(fileUrl, "_blank");
    }
  };

  // Password-protected download
  const handlePasswordDownload = async (password) => {
    try {
      setPwdLoading(true);
      setPwdError("");
      // Send password as query param — backend must support this
      const res = await api.get(`/documents/${id}/download`, {
        params:       { password },
        responseType: "blob",
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowPwdModal(false);
      toast("Download started", "success");
    } catch (err) {
      setPwdError(
        err.response?.status === 403
          ? "Incorrect password. Please try again."
          : "Download failed. Please try again."
      );
    } finally { setPwdLoading(false); }
  };

  /* ── Parse summary ── */
  let summary = null;
  if (doc?.summary) {
    summary = typeof doc.summary === "object" ? doc.summary
      : (() => { try { return JSON.parse(doc.summary); } catch { return null; } })();
  }

  const isLocked  = doc?.encrypted_external || doc?.routing_status?.toLowerCase() === "locked";
  const isReview  = doc?.routing_status?.toLowerCase() === "review";
  const ext       = doc?.filename?.split(".").pop()?.toLowerCase();
  const isPDF     = ext === "pdf";
  const isImage   = ["png","jpg","jpeg","webp"].includes(ext);
  const fileUrl   = `${API_BASE}/documents/${id}/preview`;
  const dept      = getDept(doc?.department);
  const confidence = summary?.confidence_score || doc?.ai_confidence;
  const hasClauses = Array.isArray(doc?.clauses) && doc.clauses.length > 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500">
        <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm font-medium text-gray-600">Loading document…</span>
      </div>
    </div>
  );

  if (!doc) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-gray-500 text-sm">Document not found or access denied.</p>
      <button onClick={() => navigate("/documents")}
        className="text-blue-600 hover:text-blue-700 text-sm font-medium transition cursor-pointer">
        ← Back to Documents
      </button>
    </div>
  );

  return (
    <>
      <ConfirmDialog isOpen={confirmOpen} title="Delete document"
        message={`"${doc.filename}" will be permanently removed. This cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        danger onConfirm={handleDelete} onCancel={() => setConfirmOpen(false)} />

      {showPwdModal && (
        <PasswordModal
          filename={doc.filename}
          loading={pwdLoading}
          error={pwdError}
          onSubmit={handlePasswordDownload}
          onClose={() => { setShowPwdModal(false); setPwdError(""); }}
        />
      )}

      <div className="space-y-4 max-w-[1320px]">

        {/* ── Header ── */}
        <div className="fade-up flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition font-medium cursor-pointer">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"/>
            </svg>
            Back
          </button>

          <div className="h-4 w-px bg-gray-200" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-gray-900 truncate">{doc.filename}</h1>
              {doc.department && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md capitalize shrink-0 ${dept.color} ${dept.bg}`}>
                  {doc.department}
                </span>
              )}
              {isLocked && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md text-slate-600 bg-slate-100 border border-slate-200 shrink-0">
                  🔒 Encrypted
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              {doc.received_at ? new Date(doc.received_at).toLocaleString("en-IN", {
                day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
              }) : "—"}
              {doc.source ? ` · via ${doc.source}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition cursor-pointer">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm-1-5.47v-7a.75.75 0 0 1 1.5 0v7l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L1.22 9.56a.75.75 0 1 1 1.06-1.06Z"/>
              </svg>
              {isLocked ? "Unlock & Download" : "Download"}
            </button>
            <button onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 active:scale-95 transition cursor-pointer">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* ── Status bar ── */}
        <div className="fade-up d1 flex items-center gap-2 flex-wrap">
          <StatusBadge status={doc.status} />
          <StatusBadge status={doc.routing_status} />
          {doc.sensitivity && (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border capitalize
              ${doc.sensitivity === "high"   ? "bg-red-50 border-red-200 text-red-700" :
                doc.sensitivity === "medium" ? "bg-amber-50 border-amber-200 text-amber-700" :
                                               "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                doc.sensitivity === "high" ? "bg-red-500" :
                doc.sensitivity === "medium" ? "bg-amber-400" : "bg-emerald-500"}`} />
              {doc.sensitivity} sensitivity
            </span>
          )}
        </div>

        {/* ── Review acknowledgement banner ── */}
        {isReview && (
          <ReviewBanner docId={id} onAcknowledged={fetchDoc} />
        )}

        {/* ── Split layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

          {/* LEFT — preview */}
          <div className="fade-up d2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Preview</span>
              {ext && !previewError && (isPDF || isImage) && (
                <span className="text-[10px] font-mono text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded">
                  {ext.toUpperCase()}
                </span>
              )}
            </div>

            <div className="p-3 min-h-[500px] flex items-stretch">
              {isLocked ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-slate-400">
                      <path d="M12 2C9.243 2 7 4.243 7 7v2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V7c0-2.757-2.243-5-5-5zm0 2c1.654 0 3 1.346 3 3v2H9V7c0-1.654 1.346-3 3-3zm0 10a2 2 0 1 1-.001 4.001A2 2 0 0 1 12 14z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Encrypted Document</p>
                    <p className="text-xs text-gray-500 mt-1">This document is password-protected and cannot be previewed.</p>
                    <p className="text-xs text-gray-400 mt-0.5">Use the download button to unlock with a password.</p>
                  </div>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition active:scale-95 cursor-pointer">
                    🔒 Unlock & Download
                  </button>
                </div>
              ) : previewError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <p className="text-sm text-gray-500">Preview unavailable</p>
                  <button onClick={() => window.open(fileUrl, "_blank")}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition cursor-pointer">
                    Open in new tab →
                  </button>
                </div>
              ) : isPDF ? (
                <iframe src={previewUrl} title="Document preview" className="w-full rounded-lg"
                  style={{ minHeight: "72vh" }} onError={() => setPreviewError(true)} />
              ) : isImage ? (
                <img src={previewUrl} alt={doc.filename} className="max-h-[72vh] mx-auto rounded-lg object-contain"
                  onError={() => setPreviewError(true)} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <p className="text-sm text-gray-500">Preview not available for .{ext} files</p>
                  <button onClick={() => window.open(fileUrl, "_blank")}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition cursor-pointer">
                    Download to view →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — AI analysis */}
          <div className="space-y-3">

            {/* Tabs */}
            <div className="fade-up d2 flex gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1">
              {[
                { id: "summary",  label: "AI Analysis" },
                { id: "metadata", label: "Metadata"    },
                ...(hasClauses ? [{ id: "clauses", label: `Clauses (${doc.clauses.length})` }] : []),
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* AI Analysis tab */}
            {activeTab === "summary" && (
              <div className="fade-up bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Intelligence Report</span>
                  {confidence && <ConfidenceRing score={confidence} />}
                </div>

                <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                  {!summary ? (
                    <div className="text-center py-8">
                      {["processing","pending"].includes(doc.routing_status?.toLowerCase()) ? (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          <p className="text-sm font-medium text-gray-600">AI analysis in progress…</p>
                          <p className="text-xs text-gray-400">OCR, classification and summarization running</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">
                          {typeof doc.summary === "string" ? doc.summary : "No AI analysis available."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {summary.purpose && (
                        <div>
                          <p className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest mb-2">Purpose</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{summary.purpose}</p>
                        </div>
                      )}

                      {summary.key_points?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest mb-2">Key Findings</p>
                          <ul className="space-y-2">
                            {summary.key_points.map((pt, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[9px] font-bold font-mono text-blue-600">{i + 1}</span>
                                </div>
                                <span className="text-sm text-gray-700 leading-relaxed">{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.risks_or_implications && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                          <p className="text-[10px] font-mono font-semibold text-amber-600 uppercase tracking-widest mb-2">Risks & Implications</p>
                          <p className="text-sm text-amber-900 leading-relaxed">{summary.risks_or_implications}</p>
                        </div>
                      )}

                      {summary.data_quality_notes && summary.data_quality_notes !== "none identified" && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1">Extraction Notes</p>
                          <p className="text-xs text-gray-600">{summary.data_quality_notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Metadata tab */}
            {activeTab === "metadata" && (
              <div className="fade-up bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Metadata</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    ["AI Status",   <StatusBadge status={doc.status} />],
                    ["Routing",     <StatusBadge status={doc.routing_status} />],
                    ["Department",  <span className={`font-mono text-xs capitalize font-medium ${dept.color}`}>{doc.department || "—"}</span>],
                    ["Sensitivity", <span className={`font-mono text-xs capitalize font-medium ${
                      doc.sensitivity === "high" ? "text-red-600" :
                      doc.sensitivity === "medium" ? "text-amber-600" : "text-emerald-600"}`}>
                      {doc.sensitivity || "—"}
                    </span>],
                    ["Source",      <span className="font-mono text-xs text-gray-600 capitalize">{doc.source || "manual"}</span>],
                    ["Purpose",     <span className="font-mono text-xs text-gray-600 text-right max-w-[180px] break-words">{doc.purpose || "—"}</span>],
                    ["Document ID", <span className="font-mono text-[10px] text-gray-400">{doc.id?.slice(-12)}</span>],
                    ["Received",    <span className="font-mono text-[11px] text-gray-500">
                      {doc.received_at ? new Date(doc.received_at).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                    </span>],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="text-xs text-gray-400 font-mono shrink-0">{label}</span>
                      <div className="text-right">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 space-y-2 border-t border-gray-100">
                  <button onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition active:scale-95 cursor-pointer">
                    {isLocked ? "🔒 Unlock & Download" : "↓ Download file"}
                  </button>
                  <button onClick={() => setConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition active:scale-95 cursor-pointer">
                    Delete document
                  </button>
                </div>
              </div>
            )}

            {/* Clauses tab */}
            {activeTab === "clauses" && hasClauses && (
              <div className="fade-up bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extracted Clauses</span>
                  <span className="text-xs font-mono text-gray-400">{doc.clauses.length} clauses</span>
                </div>
                <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
                  {doc.clauses.slice(0, 20).map((clause, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition">
                      {clause.section && clause.section !== "General" && (
                        <p className="text-[10px] font-mono font-semibold text-blue-600 uppercase tracking-wider mb-1.5">{clause.section}</p>
                      )}
                      <p className="text-xs text-gray-800 leading-relaxed">{clause.clause}</p>
                      {clause.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {clause.tags.slice(0, 4).map((tag, j) => (
                            <span key={j} className="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {doc.clauses.length > 20 && (
                    <p className="text-xs text-gray-400 font-mono text-center py-2">+{doc.clauses.length - 20} more clauses</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}