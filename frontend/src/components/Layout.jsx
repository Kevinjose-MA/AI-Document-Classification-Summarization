import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Documents", path: "/documents" },
    { name: "Upload", path: "/upload" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-gray-100">

      {/* ===== TOP NAVBAR ===== */}
      <nav className="w-full bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="w-full px-10 py-4 flex items-center justify-between">

          {/* Logo */}
          <h1
            onClick={() => navigate("/dashboard")}
            className="text-2xl font-bold text-blue-600 cursor-pointer hover:scale-105 transition duration-200"
          >
            DocuFlow
          </h1>

          {/* Navigation */}
          <div className="flex items-center gap-10">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`font-medium transition duration-200 ${
                    isActive
                      ? "text-blue-600"
                      : "text-gray-600 hover:text-blue-600"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
              <span className="text-sm">👤</span>
              <span className="text-gray-700 font-medium text-sm">
                User
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 active:scale-95 transition duration-200"
            >
              Logout
            </button>
          </div>

        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="w-full px-10 py-10">
        <Outlet />
      </main>

    </div>
  );
}
