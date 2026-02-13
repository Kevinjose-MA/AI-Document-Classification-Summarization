import UploadForm from "../components/UploadForm";

export default function UploadPage() {
  return (
    <div className="space-y-8 max-w-3xl">

      <div>
        <h2 className="text-3xl font-bold text-gray-800">
          Upload Document
        </h2>
        <p className="text-gray-500 mt-1">
          Upload a new document to process and route.
        </p>
      </div>

      <UploadForm />

    </div>
  );
}
