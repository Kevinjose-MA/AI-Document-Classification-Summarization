import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onSearch={setSearch} searchValue={search} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ search }} />
        </main>
      </div>
    </div>
  );
}