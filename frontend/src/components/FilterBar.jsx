// src/components/FilterBar.jsx
import { isAdmin } from "../utils/auth";

const SELECT_CLS = `
  text-sm text-gray-700 bg-white border border-gray-200 rounded-lg
  px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500
  focus:border-transparent transition cursor-pointer
`;

const STATUSES   = ["all", "ready", "review", "processing", "locked", "failed"];
const SOURCES    = ["all", "manual", "email", "maximo", "sharepoint", "whatsapp", "cloud_link", "scan"];
const DEPARTMENTS = ["all", "engineering", "finance", "hr", "legal", "operations", "compliance", "general"];

export default function FilterBar({ filters, onChange }) {
  const admin = isAdmin();

  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-3">
      <span className="text-xs font-medium text-gray-500 mr-1">Filter</span>

      {/* Status */}
      <select value={filters.status || "all"} onChange={(e) => set("status", e.target.value)} className={SELECT_CLS}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s === "all" ? "All Statuses" : capitalize(s)}</option>
        ))}
      </select>

      {/* Source */}
      <select value={filters.source || "all"} onChange={(e) => set("source", e.target.value)} className={SELECT_CLS}>
        {SOURCES.map((s) => (
          <option key={s} value={s}>{s === "all" ? "All Sources" : s === "cloud_link" ? "Cloud Link" : capitalize(s)}</option>
        ))}
      </select>

      {/* Department — admin only */}
      {admin && (
        <select value={filters.department || "all"} onChange={(e) => set("department", e.target.value)} className={SELECT_CLS}>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d === "all" ? "All Departments" : capitalize(d)}</option>
          ))}
        </select>
      )}

      {/* Active indicator */}
      {(filters.status !== "all" || filters.source !== "all" || (admin && filters.department !== "all")) && (
        <button
          onClick={() => onChange({ status: "all", source: "all", department: "all" })}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
            <path d="M2.22 2.22a.749.749 0 0 1 1.06 0L6 4.939 8.72 2.22a.749.749 0 1 1 1.06 1.06L7.061 6 9.78 8.72a.749.749 0 1 1-1.06 1.06L6 7.061 3.28 9.78a.749.749 0 1 1-1.06-1.06L4.939 6 2.22 3.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}