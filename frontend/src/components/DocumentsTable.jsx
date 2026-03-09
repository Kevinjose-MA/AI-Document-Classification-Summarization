// src/components/DocumentsTable.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const PAGE_SIZE = 15;

function FileIcon({ filename }) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  const map = {
    pdf:  { bg: "bg-red-100",    text: "text-red-600",    label: "PDF"  },
    docx: { bg: "bg-blue-100",   text: "text-blue-600",   label: "DOC"  },
    doc:  { bg: "bg-blue-100",   text: "text-blue-600",   label: "DOC"  },
    xlsx: { bg: "bg-green-100",  text: "text-green-600",  label: "XLS"  },
    csv:  { bg: "bg-green-100",  text: "text-green-600",  label: "CSV"  },
    png:  { bg: "bg-purple-100", text: "text-purple-600", label: "IMG"  },
    jpg:  { bg: "bg-purple-100", text: "text-purple-600", label: "IMG"  },
    jpeg: { bg: "bg-purple-100", text: "text-purple-600", label: "IMG"  },
  };
  const s = map[ext] || { bg: "bg-gray-100", text: "text-gray-500", label: "FILE" };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function DocumentsTable({ documents, loading, searchValue }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const filtered = documents.filter((d) => {
    if (!searchValue) return true;
    const q = searchValue.toLowerCase();
    return (
      d.filename?.toLowerCase().includes(q) ||
      d.purpose?.toLowerCase().includes(q) ||
      d.department?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
              <div className="w-8 h-8 rounded-md bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-2.5 bg-gray-100 rounded w-1/4" />
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-md" />
              <div className="h-5 w-14 bg-gray-100 rounded-md" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-gray-400">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No documents found</p>
        <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or search query</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Document</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Routing</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon filename={doc.filename} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{doc.filename}</p>
                      {doc.purpose && (
                        <p className="text-xs text-gray-400 truncate max-w-[240px]">{doc.purpose}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <StatusBadge status={doc.routing_status} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-gray-600 capitalize">{doc.department || "—"}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-gray-500 capitalize">{doc.source || "manual"}</span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className="text-xs text-gray-500">
                    {new Date(doc.received_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">
                    View →
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} documents
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-7 text-xs font-medium rounded-lg transition ${
                    safePage === pageNum
                      ? "bg-blue-600 text-white border border-blue-600"
                      : "text-gray-600 border border-gray-200 hover:bg-white"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}