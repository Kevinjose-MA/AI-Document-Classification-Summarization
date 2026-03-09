// src/components/Topbar.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../utils/auth";
import api from "../api/axios";

export default function Topbar({ onSearch, searchValue }) {
  const navigate = useNavigate();
  const user = getUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [alerts, setAlerts]             = useState([]);
  const dropRef  = useRef(null);
  const notifRef = useRef(null);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    api.get("/documents")
      .then((r) => {
        const flagged = (r.data || [])
          .filter((d) => ["failed","rejected","review"].includes(d.routing_status?.toLowerCase()))
          .slice(0, 8)
          .map((d) => ({
            id:      d.id,
            title:   d.filename,
            type:    ["failed","rejected"].includes(d.routing_status?.toLowerCase()) ? "error" : "warning",
            message: d.routing_status?.toLowerCase() === "review" ? "Needs review" : "Processing failed",
            dept:    d.department,
          }));
        setAlerts(flagged);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/login"); };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-4 shrink-0">
      <div className="relative flex-1 max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-3.04-3.04Zm-5.44-1.19a4.5 4.5 0 1 0 6.362-6.362 4.5 4.5 0 0 0-6.363 6.363Z" />
        </svg>
        <input type="text" placeholder="Search documents…" value={searchValue || ""}
          onChange={(e) => onSearch?.(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen((p) => !p)}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 16a2 2 0 0 0 1.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 0 0 8 16ZM3 5a5 5 0 0 1 10 0v2.947c0 .05.015.098.042.139l1.703 2.555A1.519 1.519 0 0 1 13.482 13H2.518a1.516 1.516 0 0 1-1.263-2.36l1.703-2.554A.255.255 0 0 0 3 7.947V5Z" />
            </svg>
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Alerts</p>
                {alerts.length > 0 && (
                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">{alerts.length}</span>
                )}
              </div>
              {alerts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">No alerts — all documents healthy</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {alerts.map((a) => (
                    <button key={a.id} onClick={() => { navigate(`/documents/${a.id}`); setNotifOpen(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition">
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          a.type === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}>
                          {a.type === "error" ? "FAIL" : "REV"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{a.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.message}{a.dept ? ` · ${a.dept}` : ""}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {alerts.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100">
                  <button onClick={() => { navigate("/documents"); setNotifOpen(false); }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition">
                    View all in Documents →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={dropRef} className="relative">
          <button onClick={() => setDropdownOpen((p) => !p)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-900 leading-none">{user?.name || user?.username || "User"}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{user?.role || "user"}</p>
            </div>
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 text-gray-400">
              <path d="M6 8.825c-.2 0-.4-.1-.5-.2l-3.3-3.3c-.3-.3-.3-.8 0-1.1.3-.3.8-.3 1.1 0l2.7 2.7 2.7-2.7c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1l-3.3 3.3c-.1.1-.3.2-.5.2Z" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.name || user?.username}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="p-1">
                <button onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-gray-400">
                    <path fillRule="evenodd" d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699a5.014 5.014 0 0 1 1.353.778l1.572-.699a.5.5 0 0 1 .635.225l.548.948a.5.5 0 0 1-.115.641l-1.303 1.066a5.037 5.037 0 0 1 0 1.584l1.303 1.066a.5.5 0 0 1 .115.64l-.548.949a.5.5 0 0 1-.635.225l-1.572-.7a5.014 5.014 0 0 1-1.353.779l-.17 1.698a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.698a5.014 5.014 0 0 1-1.353-.779l-1.572.7a.5.5 0 0 1-.635-.225l-.548-.949a.5.5 0 0 1 .115-.64l1.303-1.066a5.037 5.037 0 0 1 0-1.584L2.592 5.342a.5.5 0 0 1-.115-.64l.548-.949a.5.5 0 0 1 .635-.225l1.572.699a5.014 5.014 0 0 1 1.353-.778l.17-1.699ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
                  </svg>
                  Settings
                </button>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M2 4.75C2 3.784 2.784 3 3.75 3h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 11.25v-6.5Zm9.44.47a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97H6.75a.75.75 0 0 1 0-1.5h6.69l-.97-.97a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}