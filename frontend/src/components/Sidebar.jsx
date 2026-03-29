// src/components/Sidebar.jsx
import { Link, useLocation } from "react-router-dom";
import { getUser, isAdmin } from "../utils/auth";

const NAV = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v3.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 7 10V6a1 1 0 0 1 1-1Z" />
      </svg>
    ),
  },
  {
    path: "/documents",
    label: "Documents",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: "/upload",
    label: "Upload",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
    ),
  },
  {
    path: "/ingestion",
    label: "Ingestion",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
    ),
  },
];

const ADMIN_NAV = [
  {
    path: "/users",
    label: "Users",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
      </svg>
    ),
  },
  {
    path: "/audit-log",
    label: "Audit Log",
    icon: "📋",
  },
];

const BOTTOM_NAV = [
  {
    path: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const admin = isAdmin();

  const allNav = [...NAV, ...(admin ? ADMIN_NAV : [])];

  const NavItem = ({ item }) => {
    const active = location.pathname.startsWith(item.path);
    return (
      <Link
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-150 group relative
          ${active
            ? "bg-blue-50 text-blue-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
      >
        <span className={`shrink-0 ${active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`}>
          {item.icon}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      style={{ width: collapsed ? "56px" : "220px" }}
      className="h-screen flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-200 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3.5 h-3.5">
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Z" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-900 truncate">DocuFlow</span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="ml-auto text-gray-400 hover:text-gray-600 transition p-1 rounded-md hover:bg-gray-100"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z" />
            </svg>
          </button>
        )}
        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto text-gray-400 hover:text-gray-600 transition p-1 rounded-md hover:bg-gray-100"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.22 12.78a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06L7.28 3.22a.75.75 0 0 0-1.06 1.06L9.94 8 6.22 11.72a.75.75 0 0 0 0 1.06Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {allNav.map((item) => <NavItem key={item.path} item={item} />)}
      </nav>

      {/* Divider + bottom nav */}
      <div className="p-2 border-t border-gray-100 space-y-0.5">
        {BOTTOM_NAV.map((item) => <NavItem key={item.path} item={item} />)}
      </div>
    </aside>
  );
}