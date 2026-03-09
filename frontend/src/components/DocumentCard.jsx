// components/DocumentCard.jsx
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const FILE_ICONS = {
  pdf:  { bg: "bg-red-50",   text: "text-red-500",   label: "PDF"  },
  docx: { bg: "bg-blue-50",  text: "text-blue-500",  label: "DOC"  },
  doc:  { bg: "bg-blue-50",  text: "text-blue-500",  label: "DOC"  },
  txt:  { bg: "bg-gray-50",  text: "text-gray-500",  label: "TXT"  },
  png:  { bg: "bg-green-50", text: "text-green-500", label: "IMG"  },
  jpg:  { bg: "bg-green-50", text: "text-green-500", label: "IMG"  },
  jpeg: { bg: "bg-green-50", text: "text-green-500", label: "IMG"  },
  eml:  { bg: "bg-purple-50",text: "text-purple-500",label: "EML"  },
};

export default function DocumentCard({ doc }) {
  const navigate = useNavigate();
  const ext = doc.filename?.split(".").pop()?.toLowerCase();
  const icon = FILE_ICONS[ext] || { bg: "bg-gray-50", text: "text-gray-400", label: "FILE" };

  return (
    <div
      onClick={() => navigate(`/documents/${doc.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer
                 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        {/* File type badge */}
        <div className={`shrink-0 w-10 h-10 rounded-lg ${icon.bg} flex items-center justify-center`}>
          <span className={`text-xs font-bold ${icon.text}`}>{icon.label}</span>
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {doc.filename}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {doc.purpose || "No purpose specified"}
          </p>
        </div>

        <StatusBadge status={doc.status} />
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <StatusBadge status={doc.routing_status} />
        </div>
        <span className="text-xs text-gray-400">
          {new Date(doc.received_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
          })}
        </span>
      </div>
    </div>
  );
}