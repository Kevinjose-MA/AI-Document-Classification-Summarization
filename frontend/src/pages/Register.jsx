
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { value: "user",        label: "General User"      },
  { value: "hr",          label: "Human Resources"   },
  { value: "finance",     label: "Finance"           },
  { value: "legal",       label: "Legal"             },
  { value: "engineering", label: "Engineering"       },
];

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password } = form;
    if (!name || !email || !password) { setError("All fields are required."); return; }
    try {
      setLoading(true); setError("");
      const res = await api.post("/auth/register", form);
      // Auto-login the new user so they land in the platform
      if (res.data?.token) {
        login(res.data.token);
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/login");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4FA] px-4 py-12">
      <div className="w-full max-w-[400px] space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0D1525] rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" fill="#00C2D4"/>
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-[#0D1525]">DocuFlow AI · KMRL</span>
        </div>

        <div>
          <h1 className="text-[22px] font-bold text-[#0D1525] tracking-tight">Create account</h1>
          <p className="text-[13px] text-[#8896A8] mt-1">
            Request access to the document intelligence platform
          </p>
        </div>

        <div className="panel p-6 space-y-4 shadow-sm">

          {error && (
            <div className="flex items-center gap-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {[
              { name: "name",     label: "Full Name",     type: "text",     ph: "Jane Smith"        },
              { name: "email",    label: "Email address", type: "email",    ph: "jane@kmrl.co.in"   },
              { name: "password", label: "Password",      type: "password", ph: "min. 8 characters" },
            ].map(f => (
              <div key={f.name}>
                <label className="text-[12px] font-semibold text-[#4A5568] block mb-1">{f.label}</label>
                <input type={f.type} name={f.name} value={form[f.name]} onChange={set}
                  placeholder={f.ph}
                  className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                             placeholder:text-[#C8D0DE] transition"
                />
              </div>
            ))}

            <div>
              <label className="text-[12px] font-semibold text-[#4A5568] block mb-1">Department / Role</label>
              <select name="role" value={form.role} onChange={set}
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 text-[#4A5568] transition">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <button type="submit" disabled={loading}
              className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 mt-1
                ${loading
                  ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
                  : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] shadow-sm"
                }`}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-[13px] text-[#8896A8] text-center">
          Already have access?{" "}
          <Link to="/login" className="text-[#00C2D4] hover:text-[#0096A6] font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}