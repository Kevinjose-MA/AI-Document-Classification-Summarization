// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import api from "../api/axios";
import StatusBadge from "../components/StatusBadge";

function KpiCard({ title, value, icon, trend, delay }) {
  return (
    <div className={`fade-up ${delay} bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      {trend !== undefined && (
        <p className="text-xs text-gray-400 mt-1">{trend}</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { search } = useOutletContext() || {};
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/documents")
      .then((r) => setDocuments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total      = documents.length;
  const ready      = documents.filter((d) => ["ready","processed","completed"].includes(d.routing_status?.toLowerCase())).length;
  const processing = documents.filter((d) => ["processing","pending"].includes(d.routing_status?.toLowerCase())).length;
  const failed     = documents.filter((d) => ["failed","rejected"].includes(d.routing_status?.toLowerCase())).length;
  const review     = documents.filter((d) => d.routing_status?.toLowerCase() === "review").length;

  const recent = [...documents]
    .sort((a, b) => new Date(b.received_at) - new Date(a.received_at))
    .slice(0, 8);

  const filtered = search
    ? recent.filter((d) =>
        d.filename?.toLowerCase().includes(search.toLowerCase()) ||
        d.purpose?.toLowerCase().includes(search.toLowerCase())
      )
    : recent;

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* Page header */}
      <div className="fade-up">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard delay="d1" title="Total Documents" value={loading ? "—" : total}
          icon={<svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-500"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>}
          trend="All ingested documents"
        />
        <KpiCard delay="d2" title="Ready" value={loading ? "—" : ready}
          icon={<svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-emerald-500"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L6.75 9.19l3.97-3.97a.75.75 0 1 1 1.06 1.06Z"/></svg>}
          trend="Processed and routed"
        />
        <KpiCard delay="d3" title="Processing" value={loading ? "—" : processing}
          icon={<svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-blue-500"><path d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7-3a.75.75 0 0 1 .75.75v2.5h1.5a.75.75 0 0 1 0 1.5h-2.25A.75.75 0 0 1 7.25 9V5.75A.75.75 0 0 1 8 5Z"/></svg>}
          trend="In AI pipeline"
        />
        <KpiCard delay="d4" title="Needs Review" value={loading ? "—" : review}
          icon={<svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-500"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>}
          trend="Flagged for attention"
        />
      </div>

      {/* Recent documents */}
      <div className="fade-up d3 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 8 ingested documents</p>
          </div>
          <button
            onClick={() => navigate("/documents")}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-8 h-8 rounded-md bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/5" />
                </div>
                <div className="h-5 w-14 bg-gray-100 rounded-md" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No documents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Document</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Routing</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{doc.filename}</p>
                      {doc.purpose && <p className="text-xs text-gray-400 truncate max-w-[240px]">{doc.purpose}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={doc.routing_status} /></td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">{doc.department || "—"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-500">
                        {new Date(doc.received_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}