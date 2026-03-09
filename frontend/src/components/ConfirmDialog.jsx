// components/ConfirmDialog.jsx
export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel = "Confirm", danger }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#080E1A]/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-[#DDE3EE] p-6 w-full max-w-[380px] fade-up">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${danger ? "bg-red-50" : "bg-cyan-50"}`}>
          {danger
            ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            : <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#00C2D4]"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          }
        </div>
        <h3 className="text-[15px] font-semibold text-[#0D1525]">{title}</h3>
        <p className="text-[13px] text-[#8896A8] mt-1.5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#4A5568] bg-[#F0F4FA] rounded-lg hover:bg-[#E8EDF5] transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition active:scale-95 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#00C2D4] hover:bg-[#0096A6]"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}