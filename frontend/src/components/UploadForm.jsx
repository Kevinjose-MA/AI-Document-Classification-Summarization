import React, { useState } from "react";
import api from "../api/axios";

export default function UploadForm({ onUpload }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file || loading) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const response = await api.post("/documents/upload", formData);

      // Normal success
      setFile(null);
      if (onUpload) onUpload();

      alert("Upload successful");

    } catch (err) {
      console.error(err);

      if (err.response?.status === 409) {
        const data = err.response.data.detail;

        alert(
          `This file was already uploaded: ${data.filename}`
        );

        return;
      }

      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4 max-w-xl">
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Document
        </label>

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-blue-500 transition"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className={`w-full px-4 py-2 rounded-lg font-medium transition duration-200
          ${
            loading || !file
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
          }`}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}
