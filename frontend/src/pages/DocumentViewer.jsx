// pages/DocumentViewer.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

const DEPT_CFG = {
  engineering: { color: "text-blue-600", bg: "bg-blue-50", label: "Engineering" },
  finance:     { color: "text-emerald-600", bg: "bg-emerald-50", label: "Finance" },
  legal:       { color: "text-violet-600", bg: "bg-violet-50", label: "Legal" },
  hr:          { color: "text-pink-600", bg: "bg-pink-50", label: "HR" },
  general:     { color: "text-slate-600", bg: "bg-slate-50", label: "General" },
};
const getDept = k => DEPT_CFG[(k || "general").toLowerCase()] || DEPT_CFG.general;

// AI confidence ring component
function ConfidenceRing({ score }) {
  const pct = Math.round((score || 0.75) * 100);
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#EEF2F8" strokeWidth="3" />
          <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono" style={{ color }}>
          {pct}
        </span>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-[#0D1525]">AI Confidence</p>
        <p className="text-[10px] text-[#8896A8] font-mono">{pct >= 80 ? "High" : pct >= 60 ? "Medium" : "Low"} confidence</p>
      </div>
    </div>
  );
}

export default function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary | metadata | clauses

  useEffect(() => {
    api.get(`/documents/${id}`)
      .then(r => setDoc(r.data))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/documents/${id}`);
      toast("Document deleted successfully", "success");
      navigate("/documents");
    } catch {
      toast("Failed to delete document", "error");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-[#8896A8]">
        <svg className="w-5 h-5 animate-spin text-[#00C2D4]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[13px] font-mono">Loading document intelligence…</span>
      </div>
    </div>
  );

  if (!doc) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-[#8896A8] text-[13px]">Document not found or access denied.</p>
      <button onClick={() => navigate("/documents")} className="text-[#00C2D4] text-sm hover:underline font-medium">
        ← Back to repository
      </button>
    </div>
  );

  let summary = null;
  if (doc.summary) {
    summary = typeof doc.summary === "object" ? doc.summary : (() => {
      try { return JSON.parse(doc.summary); } catch { return null; }
    })();
  }

  const ext = doc.filename?.split(".").pop()?.toLowerCase();
  const isPDF = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const fileUrl = `http://localhost:8000/api/v1/documents/${doc.id}/preview`;
  const dept = getDept(doc.department);
  const confidenceScore = summary?.confidence_score || 0.78;

  const hasClauses = doc.clauses && Array.isArray(doc.clauses) && doc.clauses.length > 0;

  return (
    <>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete document"
        message={`"${doc.filename}" will be permanently removed from the intelligence platform. This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="space-y-4 max-w-[1320px]">

        {/* Header */}
        <div className="fade-up d1 flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[13px] text-[#4A5568] hover:text-[#0D1525] transition font-medium">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Repository
          </button>

          <div className="h-4 w-px bg-[#DDE3EE]" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold text-[#0D1525] truncate">{doc.filename}</h1>
              {doc.department && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded capitalize ${dept.color} ${dept.bg} shrink-0`}>
                  {doc.department}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-[#8896A8]">
                {doc.received_at ? new Date(doc.received_at).toLocaleString("en-IN", {
                  day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
                }) : "—"}
              </span>
              {doc.source && (
                <>
                  <span className="text-[#C8D0DE]">·</span>
                  <span className="text-[11px] font-mono text-[#8896A8] capitalize">via {doc.source}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#4A5568] bg-white border border-[#DDE3EE] rounded-xl hover:bg-[#F0F4FA] transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download
            </a>
            <button onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="fade-up d2 flex items-center gap-3 flex-wrap">
          <StatusBadge status={doc.status} />
          <StatusBadge status={doc.routing_status} />
          {doc.sensitivity && (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium font-mono capitalize
              ${doc.sensitivity === "high" ? "text-red-700 bg-red-50 border-red-200" :
                doc.sensitivity === "medium" ? "text-amber-700 bg-amber-50 border-amber-200" :
                "text-emerald-700 bg-emerald-50 border-emerald-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                doc.sensitivity === "high" ? "bg-red-500" :
                doc.sensitivity === "medium" ? "bg-amber-400" : "bg-emerald-500"}`} />
              {doc.sensitivity} sensitivity
            </span>
          )}
          {doc.encrypted_external && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium font-mono text-slate-600 bg-slate-50 border-slate-200">
              🔒 Encrypted document
            </span>
          )}
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

          {/* ── Left: Document preview ── */}
          <div className="fade-up d3 panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EEF2F8] flex items-center justify-between bg-[#F8FAFD]">
              <span className="text-[10px] font-mono font-semibold text-[#8896A8] uppercase tracking-wider">
                Document Preview
              </span>
              {(isPDF || isImage) && !previewError && (
                <span className="text-[10px] font-mono text-[#8896A8] bg-white border border-[#DDE3EE] px-2 py-0.5 rounded">
                  {ext?.toUpperCase()}
                </span>
              )}
            </div>

            <div className="p-3 min-h-[500px] flex items-stretch">
              {previewError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <div className="w-14 h-14 bg-[#F0F4FA] rounded-2xl flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-[#C8D0DE]">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-[#4A5568]">Preview unavailable</p>
                    <p className="text-[12px] text-[#8896A8] mt-1">File could not be loaded inline.</p>
                  </div>
                  <a href={fileUrl} target="_blank" rel="noreferrer"
                    className="text-[13px] text-[#00C2D4] hover:underline font-medium">
                    Open in new tab →
                  </a>
                </div>
              ) : isPDF ? (
                <iframe src={fileUrl} title="Document preview" className="w-full rounded-lg"
                  style={{ minHeight: "72vh" }} onError={() => setPreviewError(true)} />
              ) : isImage ? (
                <img src={fileUrl} alt={doc.filename}
                  className="max-h-[72vh] mx-auto rounded-lg object-contain"
                  onError={() => setPreviewError(true)} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <div className="w-14 h-14 bg-[#F0F4FA] rounded-2xl flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-[#C8D0DE]">
                      <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-[#4A5568]">
                    Preview not available for <span className="font-mono">.{ext}</span> files
                  </p>
                  <a href={fileUrl} target="_blank" rel="noreferrer"
                    className="text-[13px] text-[#00C2D4] hover:underline font-medium">
                    Download to view
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: AI Analysis panel ── */}
          <div className="space-y-4">

            {/* Tabs */}
            <div className="fade-up d3 flex gap-1 bg-[#F0F4FA] border border-[#DDE3EE] rounded-xl p-1">
              {[
                { id: "summary", label: "AI Analysis" },
                { id: "metadata", label: "Metadata" },
                ...(hasClauses ? [{ id: "clauses", label: `Clauses (${doc.clauses.length})` }] : []),
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 text-[12px] font-medium rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-[#0D1525] shadow-sm border border-[#DDE3EE]"
                      : "text-[#8896A8] hover:text-[#4A5568]"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* AI Analysis Tab */}
            {activeTab === "summary" && (
              <div className="fade-up panel overflow-hidden">
                {/* AI header with confidence */}
                <div className="px-4 py-3.5 border-b border-[#EEF2F8] bg-gradient-to-r from-[#F8FAFD] to-[#F0F8FA] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 bg-[#00C2D4]/15 rounded flex items-center justify-center overflow-hidden ai-scan">
                      <span className="text-[#00C2D4] text-[9px] font-bold relative z-10">AI</span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-[#8896A8] uppercase tracking-wider">
                      AI Intelligence Report
                    </span>
                  </div>
                  <ConfidenceRing score={confidenceScore} />
                </div>

                <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                  {!summary ? (
                    <div className="text-center py-8">
                      {doc.status === "processing" ? (
                        <>
                          <div className="flex items-center justify-center gap-2 text-[#00C2D4] mb-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            <span className="text-[13px] font-medium">AI analysis in progress…</span>
                          </div>
                          <p className="text-[12px] text-[#8896A8]">OCR, classification and summarization running</p>
                        </>
                      ) : (
                        <p className="text-[13px] text-[#8896A8] font-mono">
                          {typeof doc.summary === "string" ? doc.summary : "No AI analysis available."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Purpose */}
                      {summary.purpose && (
                        <div>
                          <p className="text-[10px] font-mono font-semibold text-[#8896A8] uppercase tracking-widest mb-2">Document Purpose</p>
                          <p className="text-[13px] text-[#0D1525] leading-relaxed">{summary.purpose}</p>
                        </div>
                      )}

                      {/* Key points */}
                      {summary.key_points?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono font-semibold text-[#8896A8] uppercase tracking-widest mb-2">Key Findings</p>
                          <ul className="space-y-2.5">
                            {summary.key_points.map((pt, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-[#00C2D4]/10 border border-[#00C2D4]/20 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[9px] font-bold font-mono text-[#00C2D4]">{i + 1}</span>
                                </div>
                                <span className="text-[13px] text-[#0D1525] leading-relaxed">{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {summary.risks_or_implications && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-600">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-[10px] font-mono font-semibold text-amber-700 uppercase tracking-widest">
                              Risks & Implications
                            </p>
                          </div>
                          <p className="text-[13px] text-amber-900 leading-relaxed">{summary.risks_or_implications}</p>
                        </div>
                      )}

                      {/* Data quality */}
                      {summary.data_quality_notes && summary.data_quality_notes !== "none identified" && (
                        <div className="bg-[#F0F4FA] border border-[#DDE3EE] rounded-xl p-3">
                          <p className="text-[10px] font-mono text-[#8896A8] uppercase tracking-widest mb-1">Extraction Notes</p>
                          <p className="text-[12px] text-[#4A5568]">{summary.data_quality_notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === "metadata" && (
              <div className="fade-up panel overflow-hidden">
                <div className="px-4 py-3.5 border-b border-[#EEF2F8] bg-[#F8FAFD]">
                  <span className="text-[10px] font-mono font-semibold text-[#8896A8] uppercase tracking-wider">
                    Document Metadata
                  </span>
                </div>
                <div className="p-4 space-y-0 divide-y divide-[#EEF2F8]">
                  {[
                    ["AI Status",    <StatusBadge status={doc.status} />],
                    ["Routing",      <StatusBadge status={doc.routing_status} />],
                    ["Department",   <span className={`font-mono text-[12px] capitalize font-medium ${dept.color}`}>{doc.department || "—"}</span>],
                    ["Sensitivity",  <span className={`font-mono text-[12px] capitalize font-medium ${
                      doc.sensitivity === "high" ? "text-red-600" :
                      doc.sensitivity === "medium" ? "text-amber-600" : "text-emerald-600"}`}>
                      {doc.sensitivity || "—"}
                    </span>],
                    ["Source",       <span className="font-mono text-[12px] text-[#4A5568] capitalize">{doc.source || "manual"}</span>],
                    ["Purpose",      <span className="font-mono text-[12px] text-[#4A5568] text-right max-w-[200px] break-words">{doc.purpose || "—"}</span>],
                    ["Document ID",  <span className="font-mono text-[11px] text-[#8896A8]">{doc.id?.slice(-12)}</span>],
                    ["Received",     <span className="font-mono text-[11px] text-[#8896A8]">
                      {doc.received_at ? new Date(doc.received_at).toLocaleString("en-IN", {
                        day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
                      }) : "—"}
                    </span>],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-3">
                      <span className="text-[11px] text-[#8896A8] font-mono shrink-0">{label}</span>
                      <div className="text-right">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clauses Tab */}
            {activeTab === "clauses" && hasClauses && (
              <div className="fade-up panel overflow-hidden">
                <div className="px-4 py-3.5 border-b border-[#EEF2F8] bg-[#F8FAFD] flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-[#8896A8] uppercase tracking-wider">
                    Extracted Clauses
                  </span>
                  <span className="text-[11px] font-mono text-[#8896A8]">{doc.clauses.length} clauses</span>
                </div>
                <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
                  {doc.clauses.slice(0, 20).map((clause, i) => (
                    <div key={i} className="bg-[#F8FAFD] border border-[#EEF2F8] rounded-lg p-3 hover:border-[#00C2D4]/30 transition">
                      {clause.section && clause.section !== "General" && (
                        <p className="text-[10px] font-mono font-semibold text-[#00C2D4] uppercase tracking-wider mb-1.5">
                          {clause.section}
                        </p>
                      )}
                      <p className="text-[12px] text-[#0D1525] leading-relaxed">{clause.clause}</p>
                      {clause.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {clause.tags.slice(0, 4).map((tag, j) => (
                            <span key={j} className="text-[10px] font-mono text-[#8896A8] bg-white border border-[#DDE3EE] px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {doc.clauses.length > 20 && (
                    <p className="text-[12px] text-[#8896A8] font-mono text-center py-2">
                      +{doc.clauses.length - 20} more clauses not shown
                    </p>
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