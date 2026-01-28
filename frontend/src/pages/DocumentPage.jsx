import { useEffect, useState } from "react";
import axios from "axios";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:8000/api/v1/documents", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDocuments(res.data);
      } catch (err) {
        setError("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  if (loading) return <p className="p-4">Loading documents…</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📄 Document History</h1>

      {documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl shadow p-5 border"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-lg">{doc.filename}</h2>
                <span className="text-sm text-gray-500">
                  {new Date(doc.received_at).toLocaleString()}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Purpose: {doc.purpose}
              </p>

              <span
                className={`inline-block mb-3 px-3 py-1 text-xs rounded-full ${
                  doc.status === "ready"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {doc.status}
              </span>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {doc.summary || "Summary not available yet."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

