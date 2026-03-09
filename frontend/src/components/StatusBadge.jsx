// src/components/StatusBadge.jsx
export default function StatusBadge({ status }) {
  const s = status?.toLowerCase() || "unknown";

  const map = {
    ready:      { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
    processed:  { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
    completed:  { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
    processing: { dot: "bg-blue-500",    bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200"    },
    pending:    { dot: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200"   },
    review:     { dot: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200"   },
    failed:     { dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200"     },
    rejected:   { dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200"     },
    locked:     { dot: "bg-gray-400",    bg: "bg-gray-100",    text: "text-gray-600",    border: "border-gray-200"    },
  };

  const style = map[s] || { dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className="capitalize">{s}</span>
    </span>
  );
}