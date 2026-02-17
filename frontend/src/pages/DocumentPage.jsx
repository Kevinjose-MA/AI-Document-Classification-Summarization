import { useEffect, useState } from "react";
import api from "../api/axios";
import DocumentCard from "../components/DocumentCard";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/documents");
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800">
          All Documents
        </h2>
        <p className="text-gray-500 mt-1">
          View and manage all uploaded documents.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-gray-500 animate-pulse">
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-gray-500">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {documents
            .sort(
              (a, b) =>
                new Date(b.received_at) - new Date(a.received_at)
            )
            .map((doc) => (
              <div key={doc.id} className="min-w-0">
                <DocumentCard doc={doc} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
