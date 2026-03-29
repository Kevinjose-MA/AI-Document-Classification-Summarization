// src/pages/AuditLogPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../components/Toast";

const PER_PAGE = 25;

const EVENT_CONFIG = {
  ingested:   { label: "Ingested",   color: "bg-blue-50 text-blue-700 border-blue-200",     icon: "↓" },
  classified: { label: "Classified", color: "bg-violet-50 text-violet-700 border-violet-200", icon: "◈" },
  routed:     { label: "Routed",     color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "→" },
  reviewed:   { label: "Reviewed",   color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "✓" },
  escalated:  { label: "Escalated",  color: "bg-red-50 text-red-700 border-red-200",         icon: "⚠" },
  failed:     { label: "Failed",     color: "bg-red-50 text-red-700 border-red-200",         icon: "✕" },
  retried:    { label: "Retried",    color: "bg-amber-50 text-amber-700 border-amber-200",   icon: "↺" },
};

const AGENT_CONFIG = {
  "ingestion-pipeline": { label: "Ingestion",   color: "text-blue-600"   },
  "ocr":                { label: "OCR",          color: "text-violet-600" },
  "classifier":         { label: "Classifier",   color: "text-indigo-600" },
  "router":             { label: "Router",       color: "text-cyan-600"   },
  "escalation-agent":   { label: "Escalation",   color: "text-red-600"    },
  "human":              { label: "Human",        color: "text-emerald-600"},
  "system":             { label: "System",       color: "text-gray-500"   },
};

const EVENT_OPTS = ["all", "ingested", "classified", "routed", "reviewed", "escalated", "failed", "retried"];

function EventBadge({ event }) {
  const cfg = EVENT_CONFIG[event] || { label: event, color: "bg-gray-50 text-gray-600 border-gray-200", icon: "·" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function AgentLabel({ agent }) {
  const cfg = AGENT_CONFIG[agent] || { label: agent, color: "text-gray-500" };
  return <span className={`text-xs font-mono font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function StatusArrow({ from, to }) {
  if (!from && !to) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span className="flex items-center gap-1 text-[11px] font-mono">
      {from && <span className="text-gray-400">{from}</span>}
      {from && to && <span className="text-gray-300">→</span>}
      {to && <span className="text-gray-700 font-semibold">{to}</span>}
    </span>
  );
}

function EscalationBanner({ stats, onRunNow, running }) {
  if (!stats) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 tabular-nums">{stats.in_review}</p>
            <p className="text-xs text-gray-500 mt-0.5">In Review</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 tabular-nums">{stats.escalated}</p>
            <p className="text-xs text-gray-500 mt-0.5">Escalated</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500 tabular-nums">{stats.approaching_sla}</p>
            <p className="text-xs text-gray-500 mt-0.5">Approaching SLA</p>
          </div>
          <div className="hidden sm:block pl-4 border-l border-gray-100 space-y-0.5">
            <p className="text-[11px] font-mono text-gray-400">SLA Thresholds</p>
            <p className="text-[11px] font-mono text-gray-600">
              High: {stats.sla_thresholds?.high}h · Med: {stats.sla_thresholds?.medium}h · Low: {stats.sla_thresholds?.low}h
            </p>
          </div>
        </div>
        <button onClick={onRunNow} disabled={running}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition active:scale-95 disabled:opacity-50 cursor-pointer">
          {running ? (
            <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Running…</>
          ) : "⚡ Run Escalation Now"}
        </button>
      </div>
    </div>
  );
}

function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;
  const start = (page - 1) * PER_PAGE + 1;
  const end   = Math.min(page * PER_PAGE, total);
  const nums  = new Set([1, pages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.add(i);
  const sorted = [...nums].sort((a, b) => a - b);
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-gray-100">
      <p className="text-xs text-gray-400 font-mono">{start}–{end} of {total.toLocaleString()}</p>
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

export default function AuditLogPage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState(null);
  const [running, setRunning] = useState(false);
  const [eventFilter, setEventFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const loadStats = async () => {
    try {
      const res = await api.get("/admin/escalation/stats");
      setStats(res.data);
    } catch { /* non-admin users won't have access */ }
  };

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, per_page: PER_PAGE });
      if (eventFilter !== "all") params.set("event", eventFilter);
      const res  = await api.get(`/audit-log?${params}`);
      const data = res.data;
      setLogs(data.results || []);
      setTotal(data.total  || 0);
      setPages(data.pages  || 1);
      setPage(p);
    } catch { toast("Failed to load audit log", "error"); }
    finally { setLoading(false); }
  }, [eventFilter]);

  useEffect(() => { load(1); }, [eventFilter]);
  useEffect(() => { loadStats(); }, []);

  const runEscalation = async () => {
    try {
      setRunning(true);
      const res = await api.post("/admin/escalation/run");
      toast(res.data.message, "success");
      await Promise.all([load(1), loadStats()]);
    } catch (err) {
      toast(err.response?.data?.detail || "Escalation failed", "error");
    } finally { setRunning(false); }
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", second:"2-digit" });
  };

  return (
    <div className="space-y-4 max-w-[1400px]">

      {/* Header */}
      <div className="fade-up flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every agent decision, status change and escalation — auditable trail for PS2.
            {total > 0 && <span className="font-medium"> {total.toLocaleString()} events recorded.</span>}
          </p>
        </div>
        <button onClick={() => load(page)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer">
          ↺ Refresh
        </button>
      </div>

      {/* Escalation stats banner */}
      <EscalationBanner stats={stats} onRunNow={runEscalation} running={running} />

      {/* Event filter */}
      <div className="fade-up d1 flex gap-2 flex-wrap">
        {EVENT_OPTS.map(e => (
          <button key={e} onClick={() => setEventFilter(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer capitalize
              ${eventFilter === e ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
            {e === "all" ? `All Events` : (EVENT_CONFIG[e]?.label || e)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="fade-up d2 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Time","Event","Agent","Document","Status Change","Detail"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 animate-pulse">
                    {Array(6).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-3 bg-gray-100 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 text-sm">
                    No audit events found.
                    {eventFilter !== "all" && (
                      <button onClick={() => setEventFilter("all")} className="text-blue-600 hover:underline ml-1 cursor-pointer">
                        Clear filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : logs.map(log => (
                <>
                  <tr key={log.id}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors group">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] font-mono text-gray-500">{fmtTime(log.timestamp)}</span>
                    </td>
                    <td className="px-4 py-3.5"><EventBadge event={log.event} /></td>
                    <td className="px-4 py-3.5"><AgentLabel agent={log.agent} /></td>
                    <td className="px-4 py-3.5 max-w-[220px]">
                      <button onClick={e => { e.stopPropagation(); navigate(`/documents/${log.document_id}`); }}
                        className="text-[12px] font-medium text-blue-600 hover:text-blue-700 truncate block max-w-full text-left transition cursor-pointer">
                        {log.filename || log.document_id?.slice(-8)}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusArrow from={log.from_status} to={log.to_status} />
                    </td>
                    <td className="px-4 py-3.5 max-w-[300px]">
                      <p className="text-xs text-gray-600 truncate">{log.detail}</p>
                    </td>
                  </tr>
                  {/* Expanded metadata row */}
                  {expanded === log.id && log.metadata && Object.keys(log.metadata).length > 0 && (
                    <tr key={`${log.id}-expanded`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(log.metadata).map(([k, v]) => (
                            v !== null && v !== undefined && v !== "" && (
                              <div key={k} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-gray-400 uppercase">{k}:</span>
                                <span className="text-[11px] font-mono text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                  {String(v)}
                                </span>
                              </div>
                            )
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={p => { setPage(p); load(p); }} />
      </div>
    </div>
  );
}