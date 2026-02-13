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

  const fileUrl = doc.file_url || doc.file_path || doc.url;

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
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {doc.filename}
            </h2>

            <div className="flex gap-2 mb-4">
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

            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
              {doc.summary ||
                "No summary available for this document."}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
