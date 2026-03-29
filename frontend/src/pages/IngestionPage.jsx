// src/pages/IngestionPage.jsx
import { useEffect, useState, useRef } from "react";
import api from "../api/axios";
import { useToast } from "../components/Toast";

// WhatsApp PDF and Hard-copy Scan removed — use Manual Upload for those.
// These are the 4 ingestion sources that need configuration.
const SOURCE_CONFIG = {
  email:      { label: "Email (IMAP)",   icon: "✉️",  manual: false, canSync: true,  accept: null,
                desc: "Auto-ingest attachments from a connected Gmail / IMAP inbox" },
  maximo:     { label: "Maximo Export",  icon: "🏗️",  manual: true,  canSync: false, accept: ".csv,.xlsx,.xls,.pdf",
                desc: "Upload CSV, Excel or PDF exports from IBM Maximo" },
  sharepoint: { label: "SharePoint",     icon: "☁️",  manual: false, canSync: true,  accept: null,
                desc: "Sync documents from a SharePoint folder (OAuth required)" },
  cloud_link: { label: "Cloud Link",     icon: "🔗",  manual: true,  canSync: false, accept: null,
                desc: "Paste a direct URL to a publicly accessible document" },
};

const DEPTS = ["engineering", "finance", "legal", "hr", "operations", "compliance", "general"];

const STATUS_STYLE = {
  connected: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", label: "Connected" },
  syncing:   { dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    label: "Syncing…"  },
  error:     { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     label: "Error"     },
  pending:   { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   label: "Pending"   },
  disabled:  { dot: "bg-gray-300",    text: "text-gray-500",    bg: "bg-gray-50",     border: "border-gray-200",    label: "Disabled"  },
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

// ── Email credential fields ────────────────────────────────
function EmailFields({ form, set }) {
  const [showPwd, setShowPwd] = useState(false);
  return (
    <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">IMAP Credentials</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">IMAP Host</label>
          <input value={form.imap_host} onChange={e => set("imap_host", e.target.value)}
            placeholder="imap.gmail.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
          <input value={form.imap_port} onChange={e => set("imap_port", e.target.value)}
            placeholder="993" type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
        <input value={form.email_address} onChange={e => set("email_address", e.target.value)}
          placeholder="ingest@dept.kmrl.co.in" type="email"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">App Password</label>
        <div className="relative">
          <input value={form.email_password} onChange={e => set("email_password", e.target.value)}
            type={showPwd ? "text" : "password"} placeholder="16-char Google App Password"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          <button type="button" onClick={() => setShowPwd(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition">
            {showPwd
              ? <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-3.49 0-6.257-2.619-6.848-5.385A.75.75 0 0 1 2 7.25a.75.75 0 0 1 .848.635C3.31 10.13 5.5 12.5 8 12.5c1.335 0 2.52-.538 3.407-1.393L9.935 10.2A3.5 3.5 0 0 1 4.7 5.765L2.31 4.167a.75.75 0 0 1-.167-1.857Z"/></svg>
              : <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>
            }
          </button>
        </div>
        <p className="text-[11px] text-blue-600 mt-1">
          Use a 16-char App Password for Gmail, not your main password.{" "}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 cursor-pointer">Generate →</a>
        </p>
      </div>
    </div>
  );
}

// ── Add Source modal ───────────────────────────────────────
function AddSourceModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    type: "email", label: "", department: "", config_hint: "",
    imap_host: "imap.gmail.com", imap_port: "993", email_address: "", email_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.label)      { setError("Label is required.");      return; }
    if (!form.department) { setError("Department is required."); return; }
    if (form.type === "email") {
      if (!form.email_address)  { setError("Email address is required."); return; }
      if (!form.email_password) { setError("App password is required.");  return; }
    }
    try {
      setLoading(true); setError("");
      const sourceRes = await api.post("/ingestion-sources/", {
        type:        form.type,
        label:       form.label,
        department:  form.department,
        config_hint: form.type === "email" ? form.email_address : form.config_hint,
      });
      if (form.type === "email") {
        await api.post("/auth/email-credentials", {
          imap_host: form.imap_host, imap_port: parseInt(form.imap_port, 10),
          email_address: form.email_address, email_password: form.email_password,
        });
      }
      onCreated(sourceRes.data);
      toast("Ingestion source added", "success");
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create source.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[90vh] overflow-y-auto p-6 fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add Ingestion Source</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer">✕</button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source Type</label>
            <select value={form.type} onChange={e => set("type", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Label</label>
            <input value={form.label} onChange={e => set("label", e.target.value)}
              placeholder={`e.g. Finance ${SOURCE_CONFIG[form.type]?.label}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Department</label>
            <select value={form.department} onChange={e => set("department", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">Select department…</option>
              {DEPTS.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          {form.type === "email" ? (
            <EmailFields form={form} set={set} />
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {form.type === "sharepoint" ? "SharePoint URL" : form.type === "cloud_link" ? "Base URL (optional)" : "Notes (optional)"}
              </label>
              <input value={form.config_hint} onChange={e => set("config_hint", e.target.value)}
                placeholder={form.type === "sharepoint" ? "https://company.sharepoint.com/..." : "Optional"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 cursor-pointer">
              {loading ? "Saving…" : "Add Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Upload modal ───────────────────────────────────────────
function UploadModal({ source, onClose, onDone }) {
  const cfg = SOURCE_CONFIG[source.type] || {};
  const isLink = source.type === "cloud_link";
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [url, setUrl]   = useState("");
  const [loading, setLoad] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]  = useState("");
  const [dragging, setDrag] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    if (isLink && !url.trim()) { setError("Enter a URL."); return; }
    if (!isLink && !file)      { setError("Select a file."); return; }
    try {
      setLoad(true); setError("");
      const fd = new FormData();
      if (isLink) fd.append("url", url.trim()); else fd.append("file", file);
      const endpoint = isLink ? `/ingestion-sources/${source.id}/ingest-link` : `/ingestion-sources/${source.id}/upload`;
      const res = await api.post(endpoint, fd);
      setResult(res.data);
      toast("Document ingested", "success");
      onDone();
    } catch (err) { setError(err.response?.data?.detail || "Ingestion failed."); }
    finally { setLoad(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-6 fade-up">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">{cfg.icon}</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{isLink ? "Ingest from Link" : "Upload Document"}</h2>
            <p className="text-xs text-gray-400">{source.label}</p>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        {result ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">✓ Ingested successfully</p>
              {result.document?.filename && <p className="text-xs text-emerald-700 mt-1 font-mono">{result.document.filename}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">Close</button>
              <button onClick={() => { setResult(null); setFile(null); setUrl(""); }} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer">Upload another</button>
            </div>
          </div>
        ) : isLink ? (
          <div className="space-y-3">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/document.pdf"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">Cancel</button>
              <button onClick={submit} disabled={loading} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 cursor-pointer">{loading ? "Ingesting…" : "Ingest"}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div onClick={() => inputRef.current?.click()}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${dragging ? "border-blue-400 bg-blue-50" : file ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-gray-50 hover:border-blue-300"}`}>
              <input ref={inputRef} type="file" accept={cfg.accept} className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? <p className="text-sm font-medium text-emerald-700 truncate">{file.name}</p>
                : <div><p className="text-sm text-gray-500">Drop file or click to browse</p><p className="text-xs text-gray-400 mt-1 font-mono">{cfg.accept}</p></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">Cancel</button>
              <button onClick={submit} disabled={loading || !file} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 cursor-pointer">{loading ? "Uploading…" : "Upload & Ingest"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sync modal (shows credential status before syncing) ────
function SyncModal({ source, onClose, onDone }) {
  const toast = useToast();
  const [cred, setCred]        = useState(null);
  const [loadCred, setLoadCred] = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    api.get("/auth/email-credentials").then(r => setCred(r.data)).catch(() => setCred(null)).finally(() => setLoadCred(false));
  }, []);

  const doSync = async () => {
    try {
      setSyncing(true); setError("");
      await api.post(`/ingestion-sources/${source.id}/sync`);
      toast("Email sync triggered", "success");
      onDone(); onClose();
    } catch (err) { setError(err.response?.data?.detail || "Sync failed."); }
    finally { setSyncing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-6 fade-up">
        <h2 className="text-base font-semibold text-gray-900 mb-0.5">Trigger Email Sync</h2>
        <p className="text-xs text-gray-400 mb-4">{source.label}</p>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        {loadCred ? (
          <div className="py-6 flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            <span className="text-sm">Checking credentials…</span>
          </div>
        ) : cred ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1 mb-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Configured Inbox</p>
            <p className="text-sm font-medium text-gray-900">{cred.email_address}</p>
            <p className="text-xs text-gray-500 font-mono">{cred.imap_host}:{cred.imap_port}</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <p className="text-sm font-medium text-amber-800">No credentials found</p>
            <p className="text-xs text-amber-700 mt-1">Delete this source and re-add it with your IMAP credentials.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">Cancel</button>
          <button onClick={doSync} disabled={syncing || !cred} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 cursor-pointer">
            {syncing ? "Syncing…" : "Start Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Source card ────────────────────────────────────────────
function SourceCard({ source, onRefresh, onDelete }) {
  const cfg = SOURCE_CONFIG[source.type] || {};
  const toast = useToast();
  const [uploadTarget, setUploadTarget] = useState(null);
  const [syncTarget, setSyncTarget]     = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${source.label}"?`)) return;
    try {
      setDeleting(true);
      await api.delete(`/ingestion-sources/${source.id}`);
      toast("Source deleted", "success");
      onDelete(source.id);
    } catch { toast("Failed to delete", "error"); }
    finally { setDeleting(false); }
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "Never";

  return (
    <>
      {uploadTarget && <UploadModal source={uploadTarget} onClose={() => setUploadTarget(null)} onDone={() => { setUploadTarget(null); onRefresh(); }} />}
      {syncTarget   && <SyncModal   source={syncTarget}   onClose={() => setSyncTarget(null)}   onDone={onRefresh} />}
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{source.label}</p>
              <p className="text-xs text-gray-400 capitalize">{cfg.label} · {source.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusPill status={source.status} />
            <button onClick={handleDelete} disabled={deleting} title="Delete" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15Z"/></svg>
            </button>
          </div>
        </div>
        {source.config_hint && (
          <p className="text-xs font-mono text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 truncate">
            {source.type === "email" ? "📧 " : ""}{source.config_hint}
          </p>
        )}
        {source.error_message && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">⚠ {source.error_message}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Last sync: <span className="font-mono">{fmtDate(source.last_sync)}</span></span>
          {source.last_doc_count > 0 && <span className="font-medium text-gray-600">{source.last_doc_count} docs</span>}
        </div>
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          {source.is_manual && (
            <button onClick={() => setUploadTarget(source)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer">↑ Upload</button>
          )}
          {cfg.canSync && (
            <button onClick={() => setSyncTarget(source)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer">⟳ Sync</button>
          )}
        </div>
      </div>
    </>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function IngestionPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter]   = useState("all");

  const load = async () => {
    try { setLoading(true); const res = await api.get("/ingestion-sources/"); setSources(res.data || []); }
    catch { setSources([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? sources : sources.filter(s => s.type === filter);
  const typesPresent = [...new Set(sources.map(s => s.type))];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="fade-up flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ingestion Sources</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure and manage document ingestion channels.{sources.length > 0 && <span className="font-medium"> {sources.length} source{sources.length !== 1 ? "s" : ""} configured.</span>}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition cursor-pointer">
          + Add Source
        </button>
      </div>

      {sources.length > 0 && (
        <div className="fade-up d1 flex gap-2 flex-wrap">
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${filter === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>All ({sources.length})</button>
          {typesPresent.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${filter === t ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {SOURCE_CONFIG[t]?.icon} {SOURCE_CONFIG[t]?.label} ({sources.filter(s => s.type === t).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-44" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center fade-up">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-600 font-medium">No ingestion sources configured</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Add your first source to start ingesting documents automatically.</p>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:scale-95 transition cursor-pointer">Add first source</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((src, i) => (
            <div key={src.id} className={`fade-up d${Math.min(i + 1, 5)}`}>
              <SourceCard source={src} onRefresh={load} onDelete={(id) => setSources(p => p.filter(s => s.id !== id))} />
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onCreated={(src) => setSources(p => [src, ...p])} />}
    </div>
  );
}