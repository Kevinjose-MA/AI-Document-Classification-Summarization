// context/AuthContext.jsx
import { createContext, useContext, useState } from "react";

const Ctx = createContext(null);

const decode = (token) => {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem("token");
    return t ? decode(t) : null;
  });

  const login  = (token) => { localStorage.setItem("token", token); const p = decode(token); if (p) setUser(p); };
  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
