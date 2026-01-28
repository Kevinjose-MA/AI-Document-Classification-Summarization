import React from "react";

export default function DocumentCard({ doc }) {
  return (
    <div className="border p-4 rounded shadow-sm bg-white">
      <h2 className="font-semibold">{doc.filename}</h2>
      <p className="text-gray-600 text-sm">Purpose: {doc.purpose || "N/A"}</p>
      <p className="text-gray-600 text-sm">Status: {doc.status}</p>
      <p className="text-gray-500 text-xs">
        Received: {new Date(doc.received_at).toLocaleString()}
      </p>
    </div>
  );
}
