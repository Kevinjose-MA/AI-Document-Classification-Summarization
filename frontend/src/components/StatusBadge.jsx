export default function StatusBadge({ status }) {
  const normalizedStatus = status?.toLowerCase() || "unknown";

  const styles = {
    processed: "bg-green-100 text-green-700",
    ready: "bg-green-100 text-green-700",

    pending: "bg-yellow-100 text-yellow-700",
    review: "bg-yellow-100 text-yellow-700",

    failed: "bg-red-100 text-red-700",
    rejected: "bg-red-100 text-red-700",

    processing: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${
        styles[normalizedStatus] || "bg-gray-100 text-gray-700"
      }`}
    >
      {normalizedStatus}
    </span>
  );
}
