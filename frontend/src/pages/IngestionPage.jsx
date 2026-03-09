// src/pages/IngestionPage.jsx
// ─────────────────────────────────────────────────────────────
// NEW PAGE — mounted at /ingestion
// Shows all ingestion sources as cards.
// Admins see all depts. Dept users see only their dept.
// Compatible with existing Layout.jsx and api/axios setup.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from "react";
import api from "../api/axios"; // your existing axios instance

// ── Source type display config ─────────────────────────────
const SOURCE_CONFIG = {
  email: {
    label:   "Email",
    icon:    "✉️",
    desc:    "Ingest from configured email inbox",
    manual:  false,
    canSync: true,
    accept:  null,
  },
  maximo: {
    label:   "Maximo Export",
    icon:    "🏗️",
    desc:    "Upload Maximo CSV / Excel / PDF export",
    manual:  true,
    canSync: false,
    accept:  ".csv,.xlsx,.xls,.pdf",
  },
  sharepoint: {
    label:   "SharePoint",
    icon:    "☁️",
    desc:    "Sync from SharePoint folder",
    manual:  false,
    canSync: true,   // stub — shows button, returns placeholder
  },
  whatsapp: {
    label:   "WhatsApp PDF",
    icon:    "💬",
    desc:    "Upload PDF received via WhatsApp",
    manual:  true,
    canSync: false,
    accept:  ".pdf",
  },
  scan: {
    label:   "Hard-copy Scan",
    icon:    "🖨️",
    desc:    "Upload scanned document for OCR",
    manual:  true,
    canSync: false,
    accept:  ".pdf,.png,.jpg,.jpeg",
  },
  cloud_link: {
    label:   "Cloud Link",
    icon:    "🔗",
    desc:    "Paste a direct link to a document",
    manual:  true,
    canSync: false,
    accept:  null,   // uses URL input instead of file
  },
};

// ── Status display ─────────────────────────────────────────
const STATUS_STYLE = {
  connected: { dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200", label: "Connected"  },
  syncing:   { dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",  label: "Syncing…"   },
  error:     { dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",   label: "Error"      },
  pending:   { dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200",label: "Pending"    },
  disabled:  { dot: "bg-gray-300",   text: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",  label: "Disabled"   },
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Add Source modal ───────────────────────────────────────
function AddSourceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ type: "email", label: "", department: "", config_hint: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const DEPTS = ["engineering", "finance", "legal", "hr", "operations", "compliance", "general"];

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.label || !form.department) { setError("Label and department are required."); return; }
    try {
      setLoading(true); setError("");
      const res = await api.post("/ingestion-sources/", form);
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create source.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Ingestion Source</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source Type</label>
            <select value={form.type} onChange={e => set("type", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Label</label>
            <input value={form.label} onChange={e => set("label", e.target.value)}
              placeholder={`e.g. Finance ${SOURCE_CONFIG[form.type]?.label}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Department</label>
            <select value={form.department} onChange={e => set("department", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select department…</option>
              {DEPTS.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {form.type === "email" ? "Email address" : form.type === "sharepoint" ? "SharePoint URL" : form.type === "cloud_link" ? "Base URL (optional)" : "Notes"}
            </label>
            <input value={form.config_hint} onChange={e => set("config_hint", e.target.value)}
              placeholder={form.type === "email" ? "ingest@dept.kmrl.co.in" : form.type === "sharepoint" ? "https://sharepoint.com/..." : "Optional"}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? "Creating…" : "Add Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Upload modal (manual sources) ──────────────────────────
function UploadModal({ source, onClose, onDone }) {
  const cfg        = SOURCE_CONFIG[source.type] || {};
  const isLink     = source.type === "cloud_link";
  const [file, setFile]   = useState(null);
  const [url, setUrl]     = useState("");
  const [loading, setLoad] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]  = useState("");
  const [dragging, setDrag] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    if (isLink && !url.trim()) { setError("Please enter a URL."); return; }
    if (!isLink && !file)      { setError("Please select a file."); return; }
    try {
      setLoad(true); setError("");
      let res;
      if (isLink) {
        const fd = new FormData();
        fd.append("url", url.trim());
        res = await api.post(`/ingestion-sources/${source.id}/ingest-link`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        const fd = new FormData();
        fd.append("file", file);
        res = await api.post(`/ingestion-sources/${source.id}/upload`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      setResult(res.data);
      onDone();
    } catch (err) {
      setError(err.response?.data?.detail || "Ingestion failed.");
    } finally { setLoad(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">{cfg.icon}</span>
          <h2 className="text-lg font-semibold text-gray-900">
            {isLink ? "Ingest from Link" : "Upload Document"}
          </h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Source: <span className="font-medium text-gray-700">{source.label}</span></p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</p>}

        {result ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-green-800">✓ Document ingested successfully</p>
              {result.document?.filename && <p className="text-xs text-green-700 mt-1 font-mono">{result.document.filename}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Close</button>
              <button onClick={() => setResult(null)} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Upload another</button>
            </div>
          </div>
        ) : isLink ? (
          <div className="space-y-3">
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
              <button onClick={submit} disabled={loading}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? "Ingesting…" : "Ingest"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                ${dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
              <input ref={inputRef} type="file" accept={cfg.accept} className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file
                ? <p className="text-sm font-medium text-green-700">{file.name}</p>
                : <div><p className="text-sm text-gray-500">Drop file or click to browse</p><p className="text-xs text-gray-400 mt-1">{cfg.accept}</p></div>
              }
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
              <button onClick={submit} disabled={loading || !file}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? "Uploading…" : "Upload & Ingest"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Source card ────────────────────────────────────────────
function SourceCard({ source, onRefresh }) {
  const cfg      = SOURCE_CONFIG[source.type] || {};
  const [syncing, setSyncing] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);

  const triggerSync = async () => {
    try {
      setSyncing(true);
      await api.post(`/ingestion-sources/${source.id}/sync`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || "Sync failed");
    } finally { setSyncing(false); }
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "Never";

  return (
    <>
      {uploadTarget && (
        <UploadModal
          source={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onDone={() => { setUploadTarget(null); onRefresh(); }}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{source.label}</p>
              <p className="text-xs text-gray-400 capitalize">{cfg.label} · {source.department}</p>
            </div>
          </div>
          <StatusPill status={source.status} />
        </div>

        {/* Config hint */}
        {source.config_hint && (
          <p className="text-xs font-mono text-gray-400 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5 truncate">
            {source.config_hint}
          </p>
        )}

        {/* Error message */}
        {source.error_message && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
            ⚠ {source.error_message}
          </p>
        )}

        {/* Sync info */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Last sync: <span className="font-mono">{fmtDate(source.last_sync)}</span></span>
          {source.last_doc_count && source.last_doc_count !== "0" && (
            <span className="font-medium text-gray-600">{source.last_doc_count} docs</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          {source.is_manual && (
            <button
              onClick={() => setUploadTarget(source)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              ↑ Upload
            </button>
          )}
          {cfg.canSync && (
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "⟳ Sync"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────
export default function IngestionPage() {
  const [sources, setSources]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [filter, setFilter]     = useState("all"); // all | email | maximo | ...

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ingestion-sources/");
      setSources(res.data || []);
    } catch {
      setSources([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? sources : sources.filter(s => s.type === filter);

  const typeGroups = Object.keys(SOURCE_CONFIG);
  const counts     = typeGroups.reduce((acc, t) => {
    acc[t] = sources.filter(s => s.type === t).length;
    return acc;
  }, {});

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingestion Sources</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure and manage document ingestion channels.
            {" "}{sources.length > 0 && <span className="font-medium">{sources.length} source{sources.length !== 1 ? "s" : ""} configured.</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition active:scale-95">
          + Add Source
        </button>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
          All ({sources.length})
        </button>
        {typeGroups.map(t => counts[t] > 0 && (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === t ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
            {SOURCE_CONFIG[t].icon} {SOURCE_CONFIG[t].label} ({counts[t]})
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-8 h-8 bg-gray-100 rounded" /><div className="flex-1 space-y-2"><div className="h-3.5 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div></div>
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-600 font-medium">No ingestion sources configured yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Add your first source to start ingesting documents</p>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            Add first source
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(src => (
            <SourceCard key={src.id} source={src} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddSourceModal
          onClose={() => setShowAdd(false)}
          onCreated={(src) => setSources(p => [src, ...p])}
        />
      )}
    </div>
  );
}