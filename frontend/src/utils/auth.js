// src/utils/auth.js
export function getUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function isAdmin() {
  return getUser()?.role?.toLowerCase() === "admin";
}