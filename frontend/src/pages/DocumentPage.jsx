// src/pages/DocumentPage.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import api from "../api/axios";

/* ── Constants ───────────────────────────────────────────── */
const PER_PAGE = 15;

const STATUSES = [
  { value: "all",        label: "All Statuses" },
  { value: "ready",      label: "Ready" },
  { value: "review",     label: "In Review" },
  { value: "processing", label: "Processing" },
  { value: "pending",    label: "Pending" },
  { value: "failed",     label: "Failed" },
];

const SOURCES = [
  { value: "all",        label: "All Sources" },
  { value: "email",      label: "Email" },
  { value: "manual",     label: "Manual Upload" },
  { value: "scan",       label: "Scan" },
  { value: "maximo",     label: "Maximo" },
  { value: "whatsapp",   label: "WhatsApp" },
  { value: "cloud_link", label: "Cloud Link" },
];

const DEPTS = [
  "all","engineering","finance","legal","hr","operations","compliance","general"
];

/* ── Small helpers ───────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    ready:      "bg-emerald-50 text-emerald-700 border-emerald-200",
    review:     "bg-amber-50  text-amber-700  border-amber-200",
    processing: "bg-blue-50   text-blue-700   border-blue-200",
    pending:    "bg-gray-100  text-gray-600   border-gray-200",
    failed:     "bg-red-50    text-red-700    border-red-200",
    locked:     "bg-purple-50 text-purple-700 border-purple-200",
  };
  const label = { ready:"Ready", review:"In Review", processing:"Processing",
                  pending:"Pending", failed:"Failed", locked:"Locked" };
  const s = status?.toLowerCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${map[s] || map.pending}`}>
      {label[s] || status || "—"}
    </span>
  );
}

function FileBadge({ filename }) {
  const ext = (filename?.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "bg-red-100 text-red-700", docx: "bg-blue-100 text-blue-700",
    doc: "bg-blue-100 text-blue-700", xlsx: "bg-emerald-100 text-emerald-700",
    xls: "bg-emerald-100 text-emerald-700", png: "bg-purple-100 text-purple-700",
    jpg: "bg-purple-100 text-purple-700", jpeg: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${map[ext] || "bg-gray-100 text-gray-500"}`}>
      {ext || "—"}
    </span>
  );
}

function Select({ value, onChange, options, className = "" }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${className}`}>
      {options.map(o => (
        <option key={o.value || o} value={o.value || o}>
          {o.label || (o.charAt(0).toUpperCase() + o.slice(1))}
        </option>
      ))}
    </select>
  );
}

function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;
  const start = (page - 1) * PER_PAGE + 1;
  const end   = Math.min(page * PER_PAGE, total);

  const nums = new Set([1, pages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.add(i);
  const sorted = [...nums].sort((a, b) => a - b);

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-gray-100">
      <p className="text-xs text-gray-400 font-mono">
        {start}–{end} of <span className="font-semibold text-gray-700">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
          ← Prev
        </button>
        {sorted.map((n, i) => (
          <span key={n}>
            {i > 0 && sorted[i] - sorted[i-1] > 1 && <span className="px-1 text-xs text-gray-400">…</span>}
            <button onClick={() => onChange(n)}
              className={`w-8 h-8 text-xs font-medium rounded-lg transition cursor-pointer
                ${n === page ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {n}
            </button>
          </span>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
          Next →
        </button>
      </div>
    </div>
  );
}

/* ── Mark as Reviewed inline button ─────────────────────── */
function ReviewButton({ doc, onReviewed, compact = false }) {
  const [loading, setLoading] = useState(false);
  if (doc.routing_status !== "review") return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await api.patch(`/documents/${doc.id}`, { routing_status: "ready" });
      onReviewed(doc.id);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (compact) {
    return (
      <button onClick={handleClick} disabled={loading}
        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 active:scale-95 transition disabled:opacity-50 cursor-pointer whitespace-nowrap">
        {loading ? "…" : "✓ Review"}
      </button>
    );
  }
  return (
    <button onClick={handleClick} disabled={loading}
      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 active:scale-95 transition disabled:opacity-50 cursor-pointer whitespace-nowrap">
      {loading ? "Saving…" : "✓ Mark Reviewed"}
    </button>
  );
}

/* ── Skeleton row ────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-50">
      {Array(8).fill(0).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

/* ── MAIN PAGE ───────────────────────────────────────────── */
export default function DocumentsPage() {
  const navigate = useNavigate();
  const { search: globalSearch } = useOutletContext() || {};

  const [docs,    setDocs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [status,   setStatus]   = useState("all");
  const [source,   setSource]   = useState("all");
  const [dept,     setDept]     = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [search,   setSearch]   = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Also react to global search from Layout
  useEffect(() => {
    if (globalSearch !== undefined) setSearchInput(globalSearch);
  }, [globalSearch]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, per_page: PER_PAGE });
      if (status !== "all")   params.set("status", status);
      if (source !== "all")   params.set("source", source);
      if (dept   !== "all")   params.set("dept",   dept);
      if (dateFrom)           params.set("date_from", dateFrom);
      if (dateTo)             params.set("date_to",   dateTo);
      if (search)             params.set("search",    search);

      const res  = await api.get(`/documents?${params}`);
      const data = res.data;

      if (Array.isArray(data)) {
        // Old backend — array response, client-side everything
        let filtered = data;
        if (status !== "all") filtered = filtered.filter(d => d.routing_status?.toLowerCase() === status || d.status?.toLowerCase() === status);
        if (source !== "all") filtered = filtered.filter(d => d.source?.toLowerCase() === source);
        if (dept   !== "all") filtered = filtered.filter(d => d.department?.toLowerCase() === dept);
        if (search)           filtered = filtered.filter(d => d.filename?.toLowerCase().includes(search) || d.purpose?.toLowerCase().includes(search));
        if (dateFrom)         filtered = filtered.filter(d => new Date(d.received_at) >= new Date(dateFrom));
        if (dateTo)           filtered = filtered.filter(d => new Date(d.received_at) <= new Date(dateTo));
        filtered.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
        const start = (p - 1) * PER_PAGE;
        setDocs(filtered.slice(start, start + PER_PAGE));
        setTotal(filtered.length);
        setPages(Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
      } else {
        setDocs(data.results || []);
        setTotal(data.total  || 0);
        setPages(data.pages  || 1);
      }
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status, source, dept, dateFrom, dateTo, search]);

  // Reload on filter changes — reset to page 1
  useEffect(() => { load(1); }, [status, source, dept, dateFrom, dateTo, search]);

  const handlePageChange = (p) => { load(p); window.scrollTo(0, 0); };

  // Mark reviewed inline — update the row without refetching
  const handleReviewed = (docId) => {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, routing_status: "ready" } : d));
  };

  const hasFilters = status !== "all" || source !== "all" || dept !== "all" || dateFrom || dateTo || search;

  const clearFilters = () => {
    setStatus("all"); setSource("all"); setDept("all");
    setDateFrom(""); setDateTo(""); setSearchInput(""); setSearch("");
  };

  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" })
    : "—";

  return (
    <div className="flex flex-col h-full max-w-[1400px]">

      {/* ── Header ── */}
      <div className="fade-up flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${total.toLocaleString()} document${total !== 1 ? "s" : ""}${hasFilters ? " (filtered)" : ""} · Page ${page} of ${pages}`}
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="fade-up d1 bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-3.04-3.04ZM11.5 7a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0Z"/>
            </svg>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by filename or purpose…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>

          <Select value={status} onChange={v => setStatus(v)} options={STATUSES} />
          <Select value={source} onChange={v => setSource(v)} options={SOURCES} />
          <Select value={dept}   onChange={v => setDept(v)}
            options={DEPTS.map(d => ({ value: d, label: d === "all" ? "All Departments" : d.charAt(0).toUpperCase() + d.slice(1) }))} />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Date range:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          {hasFilters && (
            <button onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-red-500 underline transition cursor-pointer ml-1">
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="fade-up d2 bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
                {["Type","Document","Department","Status","Source","Date","Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(PER_PAGE).fill(0).map((_, i) => <SkeletonRow key={i} />)
                : docs.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-gray-400 text-sm">
                      No documents found.{" "}
                      {hasFilters && (
                        <button onClick={clearFilters} className="text-blue-600 hover:underline cursor-pointer">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )
                : docs.map(doc => (
                  <tr key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors group">
                    <td className="px-4 py-3.5">
                      <FileBadge filename={doc.filename} />
                    </td>
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <p className="font-medium text-gray-900 truncate text-[13px]">{doc.filename}</p>
                      {doc.purpose && (
                        <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{doc.purpose}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono capitalize text-gray-500">{doc.department || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={doc.routing_status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono text-gray-400 capitalize">{doc.source || "manual"}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-400">{fmtDate(doc.received_at)}</span>
                    </td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ReviewButton doc={doc} onReviewed={handleReviewed} compact />
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/documents/${doc.id}`); }}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap cursor-pointer">
                          View →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <Pagination page={page} pages={pages} total={total} onChange={handlePageChange} />
      </div>
    </div>
  );
}