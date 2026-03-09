// src/pages/Analytics.jsx
import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";

function BarChart({ data, colorClass = "bg-blue-500" }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 shrink-0 truncate capitalize">{item.label}</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
              style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6 text-right tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 40; const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={seg.color}
            strokeWidth="14" strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset} transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 0.7s ease" }} />;
          offset += dash; return el;
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="18" fill="#111827" fontWeight="700">{total}</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600 capitalize">{seg.label}</span>
            <span className="text-xs font-semibold text-gray-900 ml-auto pl-4 tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, accent = "text-gray-900" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <p className={`text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const [docs, setDocs]  = useState([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    api.get("/documents").then((r) => setDocs(r.data || [])).catch(console.error).finally(() => setLoad(false));
  }, []);

  const s = useMemo(() => {
    const total      = docs.length;
    const ready      = docs.filter((d) => ["ready","processed","completed"].includes(d.routing_status?.toLowerCase())).length;
    const processing = docs.filter((d) => ["processing","pending"].includes(d.routing_status?.toLowerCase())).length;
    const failed     = docs.filter((d) => ["failed","rejected"].includes(d.routing_status?.toLowerCase())).length;
    const review     = docs.filter((d) => d.routing_status?.toLowerCase() === "review").length;
    const locked     = docs.filter((d) => d.routing_status?.toLowerCase() === "locked").length;

    const count = (arr, key) => arr.reduce((m, d) => {
      const k = d[key]?.toLowerCase() || "unknown"; m[k] = (m[k]||0)+1; return m;
    }, {});

    const toArr = (obj) => Object.entries(obj).map(([label,value]) => ({label,value})).sort((a,b)=>b.value-a.value);

    const byDept   = toArr(count(docs, "department"));
    const bySource = toArr(count(docs, "source"));
    const bySen    = toArr(count(docs, "sensitivity"));

    const now = new Date();
    const days = Array.from({length:7}).map((_,i) => {
      const d = new Date(now); d.setDate(d.getDate()-(6-i));
      return { label: d.toLocaleDateString("en-GB",{weekday:"short"}), date: d.toDateString(), value: 0 };
    });
    docs.forEach((d) => { const slot = days.find((x) => x.date === new Date(d.received_at).toDateString()); if(slot) slot.value++; });

    const SC = { ready:"#10b981", processing:"#3b82f6", review:"#f59e0b", failed:"#ef4444", locked:"#9ca3af" };
    const statusSeg = [{label:"Ready",value:ready,color:SC.ready},{label:"Processing",value:processing,color:SC.processing},
      {label:"Review",value:review,color:SC.review},{label:"Failed",value:failed,color:SC.failed},
      {label:"Locked",value:locked,color:SC.locked}].filter(x=>x.value>0);

    const SNC = {high:"#ef4444",medium:"#f59e0b",low:"#10b981",unknown:"#9ca3af"};
    const senSeg = bySen.map((x) => ({...x, color: SNC[x.label]||"#6b7280"}));

    return { total, ready, processing, failed, review, locked, byDept, bySource, days, statusSeg, senSeg,
      readyPct: total ? Math.round((ready/total)*100) : 0,
      avgPerDay: total ? (total/30).toFixed(1) : 0 };
  }, [docs]);

  if (loading) return (
    <div className="space-y-4 max-w-[1200px]">
      <div className="fade-up"><h1 className="text-xl font-semibold text-gray-900">Analytics</h1></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_,i) => <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-24" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="fade-up">
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Document intelligence overview across all ingestion channels.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up d1">
        <StatCard title="Total Documents" value={s.total} sub="All time" />
        <StatCard title="Success Rate" value={`${s.readyPct}%`} sub="Documents ready" accent="text-emerald-600" />
        <StatCard title="Needs Attention" value={s.review+s.failed} sub="Review + failed" accent="text-amber-600" />
        <StatCard title="Avg / Day" value={s.avgPerDay} sub="Last 30 days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-up d2">
        {/* 7-day bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Ingestion — Last 7 Days</p>
          <div className="flex items-end gap-2 h-28">
            {s.days.map((d) => {
              const max = Math.max(...s.days.map((x)=>x.value),1);
              const h   = d.value===0 ? 4 : Math.max(8,(d.value/max)*100);
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-gray-600 tabular-nums">{d.value||""}</span>
                  <div className="w-full flex items-end" style={{height:"80px"}}>
                    <div className="w-full rounded-t-md bg-blue-500 transition-all duration-700"
                      style={{height:`${h}%`, opacity: d.value===0?0.15:1}} />
                  </div>
                  <span className="text-[10px] text-gray-400">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status donut */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Status Distribution</p>
          {s.statusSeg.length > 0 ? <DonutChart segments={s.statusSeg} /> : <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-up d3">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">By Department</p>
          {s.byDept.length > 0 ? <BarChart data={s.byDept} colorClass="bg-blue-500" /> : <p className="text-sm text-gray-400">No data</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">By Source</p>
          {s.bySource.length > 0 ? <BarChart data={s.bySource} colorClass="bg-violet-500" /> : <p className="text-sm text-gray-400">No data</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Sensitivity</p>
          {s.senSeg.length > 0 ? <DonutChart segments={s.senSeg} size={100} /> : <p className="text-sm text-gray-400">No data</p>}
        </div>
      </div>

      <div className="fade-up d4 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Department Breakdown</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["Department","Documents","Share","Volume"].map((h) => (
                <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {s.byDept.map((row) => {
              const pct = s.total ? Math.round((row.value/s.total)*100) : 0;
              return (
                <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 capitalize">{row.label}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{row.value}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">{pct}%</td>
                  <td className="px-5 py-3 w-48">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{width:`${pct}%`}} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}