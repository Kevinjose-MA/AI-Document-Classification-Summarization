import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";
import StatusBadge from "../components/StatusBadge";

export default function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await api.get(`/documents/${id}`);
        setDoc(res.data);
      } catch (err) {
        console.error(err);
        setDoc(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id]);

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/documents/${doc.id}`);

      alert("Document deleted successfully");

      // Go back to document list
      navigate("/documents");

    } catch (err) {
      console.error(err);
      alert("Failed to delete document");
    }
  };


  if (loading)
    return (
      <div className="text-center py-16 text-gray-500 animate-pulse">
        Loading document...
      </div>
    );

  if (!doc)
    return (
      <div className="text-center py-16 text-gray-500">
        Document not found.
      </div>
    );

    let summaryData = null;

  if (doc.summary) {
    if (typeof doc.summary === "object") {
      summaryData = doc.summary;
    } else {
      try {
        summaryData = JSON.parse(doc.summary);
      } catch {
        summaryData = null;
      }
    }
  }


  const fileUrl = `http://localhost:8000/api/v1/documents/${doc.id}/preview`;



  const fileExtension = doc.filename?.split(".").pop()?.toLowerCase();
  const isPDF = fileExtension === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(fileExtension);

  return (
    <div className="space-y-8">

      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back
        </button>

        <div className="flex gap-3">
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg
                        hover:bg-blue-700 active:scale-95
                        transition duration-200"
            >
              Download
            </a>
          )}

          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg
                      hover:bg-red-700 active:scale-95
                      transition duration-200"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ===== MAIN GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT — PREVIEW */}
        <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-4">

          {!fileUrl && (
            <div className="text-center py-20 text-gray-500">
              File not available.
            </div>
          )}

          {fileUrl && isPDF && (
            <iframe
              src={fileUrl}
              title="PDF Preview"
              className="w-full h-[75vh] rounded-lg"
            />
          )}

          {fileUrl && isImage && (
            <img
              src={fileUrl}
              alt="Preview"
              className="max-h-[75vh] mx-auto rounded-lg"
            />
          )}

          {fileUrl && !isPDF && !isImage && (
            <div className="text-center py-20 text-gray-500">
              Preview not available for this file type.
            </div>
          )}
        </div>

        {/* RIGHT — DETAILS */}
        <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">

          {/* Metadata */}
          <div className="min-w-0">
            <div className="min-w-0">
              <h2
                className="text-xl font-bold text-gray-800 mb-2
                          break-all"
              >
                {doc.filename}
              </h2>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              <StatusBadge status={doc.status} />
              <StatusBadge status={doc.routing_status} />
            </div>

            <p className="text-sm text-gray-500">
              Uploaded:{" "}
              {doc.created_at
                ? new Date(doc.created_at).toLocaleString()
                : "N/A"}
            </p>
          </div>
          
          {/* AI Summary */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">
              AI Summary
            </h3>

            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-4">

              {!summaryData && (
                <div className="text-gray-500">
                  {doc.summary || "No summary available for this document."}
                </div>
              )}

              {summaryData && (
                <>
                  {/* Purpose */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">
                      Purpose
                    </h4>
                    <p>{summaryData.purpose}</p>
                  </div>

                  {/* Key Points */}
                  {summaryData.key_points?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">
                        Key Points
                      </h4>
                      <ul className="list-disc ml-5 space-y-1">
                        {summaryData.key_points.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {summaryData.risks_or_implications && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">
                        Risks / Implications
                      </h4>
                      <p>{summaryData.risks_or_implications}</p>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
