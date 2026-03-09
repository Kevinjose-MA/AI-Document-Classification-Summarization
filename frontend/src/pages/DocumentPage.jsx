// src/pages/DocumentPage.jsx
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../api/axios";
import FilterBar from "../components/FilterBar";
import DocumentsTable from "../components/DocumentsTable";
import { isAdmin } from "../utils/auth";

export default function DocumentsPage() {
  const { search } = useOutletContext() || {};
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", source: "all", department: "all" });

  useEffect(() => {
    api.get("/documents")
      .then((r) => setDocuments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = documents.filter((d) => {
    const s = filters.status;
    const src = filters.source;
    const dept = filters.department;

    if (s !== "all" && d.routing_status?.toLowerCase() !== s && d.status?.toLowerCase() !== s) return false;
    if (src !== "all" && d.source?.toLowerCase() !== src) return false;
    if (isAdmin() && dept !== "all" && d.department?.toLowerCase() !== dept) return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-[1400px]">

      {/* Header */}
      <div className="fade-up flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${filtered.length} document${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="fade-up d1">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Table */}
      <div className="fade-up d2">
        <DocumentsTable
          documents={filtered}
          loading={loading}
          searchValue={search}
        />
      </div>
    </div>
  );
}