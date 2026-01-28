import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import DocumentCard from "../components/DocumentCard";
import UploadForm from "../components/UploadForm";
import api from "../api/axios";

export default function Dashboard() {
  const [user, setUser] = useState({ name: "User" });
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

  return (
    <div className="bg-gray-100 min-h-screen">
      <Navbar user={user} />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <UploadForm onUpload={fetchDocuments} />
          <button
            onClick={triggerEmailIngestion}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Ingest Emails
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <p>Loading documents...</p>
          ) : documents.length ? (
            documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
          ) : (
            <p>No documents found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
