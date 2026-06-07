import { useState } from "react";
import { Outlet, useLocation, matchPath } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ChatBox from "./ChatBox";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const match = matchPath({ path: "/documents/:id", end: true }, location.pathname);
  const documentId = match?.params?.id ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onSearch={setSearch} searchValue={search} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ search }} />
        </main>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-4">
        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {chatOpen ? "Close Chat" : "Open Chat"}
        </button>
        <div
          className={`w-full max-w-md transform transition-all duration-300 ${chatOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"}`}
          style={{ minWidth: 320 }}
        >
          <div className="shadow-2xl rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-xl">
            <ChatBox documentId={documentId} />
          </div>
        </div>
      </div>
    </div>
  );
}