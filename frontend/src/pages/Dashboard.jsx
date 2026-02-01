import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import UploadForm from "../components/UploadForm";
import api from "../api/axios";
import '../App.css'; // Make sure your CSS is here

export default function Dashboard() {
  const [user, setUser] = useState({ name: "User" });
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch documents and order by priority (review > ready > pending) and newest first
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/documents");

      const priorityOrder = { review: 3, ready: 2, pending: 1 };
      const orderedDocs = res.data.sort((a, b) => {
        const aPriority = priorityOrder[a.routing_status] || 0;
        const bPriority = priorityOrder[b.routing_status] || 0;
        if (bPriority !== aPriority) return bPriority - aPriority;
        return new Date(b.received_at) - new Date(a.received_at);
      });

      setDocuments(orderedDocs);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  // Trigger email ingestion
  const triggerEmailIngestion = async () => {
    try {
      await api.post("/documents/ingest-email");
      alert("Email ingestion started");
      fetchDocuments();
    } catch (err) {
      console.error(err);
      alert("Failed to start email ingestion");
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Trim long summary text
  const getTrimmedSummary = (text, maxLength = 200) => {
    if (!text) return "Summary not available yet.";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  // Map status to badge colors
  const statusColors = {
    ready: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    review: "bg-red-100 text-red-800",
  };

  // -------------------------
  // Open document in new tab
  // -------------------------
  const viewDocument = (docId) => {
    const url = `/documents/${docId}/file`; // backend endpoint
    window.open(url, "_blank");
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <Navbar user={user} />

      <div className="p-6 space-y-6">

        {/* Header actions */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <button
            onClick={triggerEmailIngestion}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow"
          >
            📤 Ingest Emails
          </button>

          <UploadForm onUpload={fetchDocuments} />
        </div>

        {/* Documents list */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📄 Document History</h2>

          {loading ? (
            <p className="text-gray-600">Loading documents...</p>
          ) : documents.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="card cursor-pointer hover:shadow-lg transition"
                  onClick={() => viewDocument(doc.id)} // <-- open on click
                >
                  {/* Header: Filename + Received */}
                  <div className="card-header">
                    <h3 className="filename">{doc.filename}</h3>
                    <span className="received-at">
                      {new Date(doc.received_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Purpose */}
                  <p className="purpose">
                    Purpose: <span className="font-medium">{doc.purpose}</span>
                  </p>

                  {/* Status & Priority Badges */}
                  <div className="badges flex gap-2 mt-2">
                    <span className={`badge ${statusColors[doc.routing_status] || ""}`}>
                      {doc.routing_status.toUpperCase()}
                    </span>
                    <span className={`badge ${statusColors[doc.status] || ""}`}>
                      {doc.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="summary mt-2 text-gray-700">
                    {getTrimmedSummary(doc.summary, 250)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No documents found.</p>
          )}
        </div>

      </div>
    </div>
  );
}
