// pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    setError("");
    try {
      setLoading(true);
      const res = await api.post("/auth/login", { email, password });
      login(res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.status === 401
        ? "Invalid credentials. Please try again."
        : "Service unavailable. Please try later."
      );
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#F0F4FA]">

      {/* Left branding panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 sidebar-grid flex-col justify-between p-10">

        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-[#00C2D4]/20 border border-[#00C2D4]/30 flex items-center justify-center overflow-hidden ai-scan">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 relative z-10">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" fill="#00C2D4" fillOpacity="0.9"/>
              <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" fill="#00C2D4" fillOpacity="0.5"/>
            </svg>
          </div>
          <div>
            <p className="text-white text-[14px] font-semibold leading-none">DocuFlow AI</p>
            <p className="text-white/30 text-[10px] font-mono mt-0.5 tracking-widest">KMRL ENTERPRISE</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-white text-[28px] font-bold leading-tight tracking-tight">
              AI Document<br />Intelligence Platform
            </h2>
    
          </div>

      
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ai-pulse" />
            <span className="text-[11px] font-mono text-white/25">All systems operational</span>
          </div>
          <p className="text-white/15 text-[11px] font-mono">© {new Date().getFullYear()} Kochi Metro Rail Limited</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#F0F4FA]">
        <div className="w-full max-w-[380px] space-y-7">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 bg-[#0D1525] rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" fill="#00C2D4"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-[#0D1525]">DocuFlow AI</span>
          </div>

          <div>
            <h1 className="text-[24px] font-bold text-[#0D1525] tracking-tight">Sign in</h1>
            <p className="text-[13px] text-[#8896A8] mt-1">Access your document intelligence workspace</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#4A5568]">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@kmrl.co.in"
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                           placeholder:text-[#C8D0DE] transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#4A5568]">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                           placeholder:text-[#C8D0DE] transition"
              />
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                ${loading || !email || !password
                  ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
                  : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] shadow-sm"}`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Authenticating…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="text-[13px] text-[#8896A8] text-center">
            No account?{" "}
            <Link to="/register" className="text-[#00C2D4] hover:text-[#0096A6] font-medium">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}