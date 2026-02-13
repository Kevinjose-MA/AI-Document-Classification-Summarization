import React from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function DocumentCard({ doc }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/documents/${doc.id}`)}
      className="bg-white rounded-xl border shadow-sm p-6 cursor-pointer
                 hover:shadow-md hover:-translate-y-1
                 transition duration-200"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg text-gray-800 truncate">
            {doc.filename}
          </h2>

          <p className="text-sm text-gray-500">
            Purpose: {doc.purpose || "Not specified"}
          </p>
        </div>

        <StatusBadge status={doc.status} />
      </div>

      <div className="mt-5 flex justify-between items-center text-sm text-gray-500">
        <span>
          {new Date(doc.received_at).toLocaleDateString()}
        </span>

        <span className="text-blue-600 font-medium">
          View →
        </span>
      </div>
    </div>
  );
}
