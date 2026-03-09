// src/pages/Settings.jsx
import { getUser } from "../utils/auth";

export default function Settings() {
  const user = getUser();

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="fade-up">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account preferences</p>
      </div>

      <div className="fade-up d1 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Profile</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-base font-semibold flex items-center justify-center shrink-0">
              {(user?.name || user?.username || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{user?.name || user?.username}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-md capitalize">
                {user?.role || "user"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Account</p>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Username</span>
              <span className="font-medium text-gray-900">{user?.username || "—"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Role</span>
              <span className="font-medium text-gray-900 capitalize">{user?.role || "user"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}