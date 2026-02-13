import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const navigate = useNavigate();
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

  // ===== KPI Calculations =====
  const total = documents.length;
  const ready = documents.filter(
    (d) => d.routing_status?.toLowerCase() === "ready"
  ).length;
  const pending = documents.filter(
    (d) => d.routing_status?.toLowerCase() === "pending"
  ).length;
  const review = documents.filter(
    (d) => d.routing_status?.toLowerCase() === "review"
  ).length;

  return (
    <div className="space-y-10">

      {/* ===== KPI SECTION ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Documents" value={total} color="blue" />
        <KpiCard title="Ready" value={ready} color="green" />
        <KpiCard title="Pending" value={pending} color="yellow" />
        <KpiCard title="Needs Review" value={review} color="red" />
      </div>

      {/* ===== RECENT DOCUMENTS ===== */}
      <div className="bg-white rounded-xl shadow-sm border p-6">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            Recent Documents
          </h2>

          <button
            onClick={() => navigate("/documents")}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition duration-200"
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 animate-pulse">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 text-sm border-b">
                  <th className="py-3 font-medium">File Name</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Routing</th>
                  <th className="font-medium">Date</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {[...documents]
                  .sort(
                    (a, b) =>
                      new Date(b.received_at) - new Date(a.received_at)
                  )
                  .slice(0, 5)
                  .map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <td className="py-4 font-medium text-gray-800">
                        {doc.filename}
                      </td>

                      <td>
                        <StatusBadge status={doc.status} />
                      </td>

                      <td>
                        <StatusBadge status={doc.routing_status} />
                      </td>

                      <td className="text-sm text-gray-500">
                        {new Date(doc.received_at).toLocaleDateString()}
                      </td>

                      <td className="text-right">
                        <span className="text-blue-600 text-sm font-medium">
                          View →
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}


/* ===== KPI CARD COMPONENT ===== */
function KpiCard({ title, value, color = "blue" }) {
  const colorMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    yellow: "text-yellow-500",
    red: "text-red-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition duration-200">
      <p className="text-sm text-gray-500 mb-2 uppercase tracking-wide">
        {title}
      </p>
      <h3 className={`text-4xl font-bold ${colorMap[color]}`}>
        {value}
      </h3>
    </div>
  );
}
