// pages/Onboarding.jsx
// Shown once after registration. User can connect inbox or skip.
// Redirect target after register should be /onboarding, not /dashboard.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";

const PROVIDERS = [
  {
    id: "gmail",
    label: "Google Workspace",
    sublabel: "Gmail / Google Apps",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#EA4335" fillOpacity=".15" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "imap.gmail.com",
    imap_port: 993,
    hint: "Use a Gmail App Password — not your regular account password.",
    helpUrl: "https://support.google.com/accounts/answer/185833",
    helpLabel: "Create a Gmail App Password →",
  },
  {
    id: "outlook",
    label: "Microsoft 365",
    sublabel: "Outlook / Office 365",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" fillOpacity=".12" stroke="#0078D4" strokeWidth="1.5"/>
        <path d="M2 8h20M8 4v16" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "outlook.office365.com",
    imap_port: 993,
    hint: "Use your Microsoft 365 email and password. If MFA is enabled, generate an App Password.",
    helpUrl: "https://support.microsoft.com/en-us/account-billing/app-passwords-a5817736-28b3-4f4c-8c7f-3a9da4174e96",
    helpLabel: "Create a Microsoft App Password →",
  },
  {
    id: "custom",
    label: "Corporate / Custom",
    sublabel: "Other IMAP server",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="2" y="6" width="20" height="12" rx="2" fill="#64748B" fillOpacity=".12" stroke="#64748B" strokeWidth="1.5"/>
        <path d="M2 10h20M6 6v12" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "",
    imap_port: 993,
    hint: "Enter your IT-provided IMAP server details.",
    helpUrl: null,
    helpLabel: null,
  },
];

// Step 1 — welcome
function StepWelcome({ user, onNext, onSkip }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-[#00C2D4]/10 border border-[#00C2D4]/20 rounded-2xl flex items-center justify-center mx-auto relative overflow-hidden ai-scan">
        <svg viewBox="0 0 20 20" fill="none" className="w-8 h-8 relative z-10">
          <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" fill="#00C2D4" fillOpacity=".9"/>
          <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" fill="#00C2D4" fillOpacity=".5"/>
        </svg>
      </div>

      <div>
        <h2 className="text-[24px] font-bold text-[#0D1525] tracking-tight">
          Welcome, {user?.name?.split(" ")[0] || "there"}
        </h2>
        <p className="text-[13px] text-[#8896A8] mt-2 max-w-sm mx-auto leading-relaxed">
          Your account is ready. Connect your corporate inbox to start automatically ingesting
          email attachments through the AI pipeline.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center max-w-sm mx-auto">
        {[
          ["Auto-ingest", "Attachments pulled on sync"],
          ["AI analysis", "Summaries generated instantly"],
          ["Smart routing", "Auto-routed to your department"],
        ].map(([title, desc]) => (
          <div key={title} className="bg-[#F8FAFD] border border-[#EEF2F8] rounded-xl p-3">
            <p className="text-[12px] font-semibold text-[#0D1525]">{title}</p>
            <p className="text-[10px] text-[#8896A8] mt-1 leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        <button
          onClick={onNext}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] transition shadow-sm"
        >
          Connect my inbox
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 rounded-xl text-[13px] text-[#8896A8] hover:text-[#4A5568] transition"
        >
          Skip for now — I'll do this later
        </button>
      </div>
    </div>
  );
}

// Step 2 — choose provider
function StepProvider({ selected, onSelect, onNext, onBack }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[#0D1525] tracking-tight">Choose your email provider</h2>
        <p className="text-[13px] text-[#8896A8] mt-1">Select the service your organisation uses.</p>
      </div>

      <div className="space-y-2.5">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all
              ${selected?.id === p.id
                ? "border-[#00C2D4] bg-[#00C2D4]/5 shadow-sm"
                : "border-[#DDE3EE] bg-white hover:border-[#C8D0DE]"
              }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border
              ${selected?.id === p.id ? "border-[#00C2D4]/30 bg-[#00C2D4]/8" : "border-[#EEF2F8] bg-[#F8FAFD]"}`}>
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0D1525]">{p.label}</p>
              <p className="text-[11px] text-[#8896A8] font-mono">{p.sublabel}</p>
            </div>
            {selected?.id === p.id && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#00C2D4] shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack}
          className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-[#4A5568] bg-[#F0F4FA] hover:bg-[#E8EDF5] transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all
            ${!selected
              ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
              : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98]"
            }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Step 3 — enter credentials
function StepCredentials({ provider, onConnected, onBack, onSkip }) {
  const toast = useToast();
  const [form, setForm] = useState({
    email_address: "",
    email_password: "",
    imap_host: provider.imap_host,
    imap_port: provider.imap_port,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleConnect = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/email/connect", {
        imap_host: form.imap_host,
        imap_port: Number(form.imap_port),
        email_address: form.email_address,
        email_password: form.email_password,
      });
      toast("Inbox connected successfully", "success");
      onConnected();
    } catch (err) {
      const msg = err.response?.data?.detail || "";
      if (msg.includes("Invalid email")) {
        toast("Wrong email or app password — please check and try again", "error");
      } else if (msg.includes("Could not connect")) {
        toast("Could not reach the mail server — check your IMAP settings", "error");
      } else {
        toast("Connection failed. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[#0D1525] tracking-tight">Enter your credentials</h2>
        <p className="text-[13px] text-[#8896A8] mt-1">
          {provider.label} · <span className="font-mono text-[12px]">{provider.imap_host || "custom server"}</span>
        </p>
      </div>

      {/* Hint */}
      <div className="bg-[#F0F4FA] border border-[#DDE3EE] rounded-xl p-3.5 flex items-start gap-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#00C2D4] shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        <div>
          <p className="text-[12px] text-[#4A5568] leading-relaxed">{provider.hint}</p>
          {provider.helpUrl && (
            <a href={provider.helpUrl} target="_blank" rel="noreferrer"
              className="text-[12px] text-[#00C2D4] hover:underline font-medium mt-1 inline-block">
              {provider.helpLabel}
            </a>
          )}
        </div>
      </div>

      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">Email address</label>
          <input name="email_address" type="email" value={form.email_address} onChange={set}
            placeholder="your@kmrl.co.in"
            className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                       placeholder:text-[#C8D0DE] transition"
          />
        </div>

        <div>
          <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">
            {provider.id === "custom" ? "Password" : "App Password"}
          </label>
          <div className="relative">
            <input name="email_password" type={showPassword ? "text" : "password"}
              value={form.email_password} onChange={set}
              placeholder="••••••••••••••••"
              className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white pr-10
                         focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                         placeholder:text-[#C8D0DE] transition"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8896A8] hover:text-[#4A5568] transition">
              {showPassword
                ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                : <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Custom IMAP host/port */}
        {provider.id === "custom" && (
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">IMAP Host</label>
              <input name="imap_host" type="text" value={form.imap_host} onChange={set}
                placeholder="mail.yourcompany.com"
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white font-mono
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                           placeholder:text-[#C8D0DE] transition"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">Port</label>
              <input name="imap_port" type="number" value={form.imap_port} onChange={set}
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white font-mono
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 transition"
              />
            </div>
          </div>
        )}

        {provider.id !== "custom" && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#8896A8] bg-[#F8FAFD] border border-[#EEF2F8] rounded-lg px-3 py-2">
            <span className="text-[#C8D0DE]">IMAP:</span>
            <span>{provider.imap_host}</span>
            <span className="text-[#C8D0DE]">·</span>
            <span>Port {provider.imap_port}</span>
            <span className="ml-auto text-[#00C2D4]">SSL/TLS</span>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onBack}
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-[#4A5568] bg-[#F0F4FA] hover:bg-[#E8EDF5] transition">
            Back
          </button>
          <button type="submit"
            disabled={loading || !form.email_address || !form.email_password || !form.imap_host}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all
              ${loading || !form.email_address || !form.email_password || !form.imap_host
                ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
                : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98]"
              }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Verifying…
              </span>
            ) : "Connect inbox"}
          </button>
        </div>

        <button type="button" onClick={onSkip}
          className="w-full py-2 text-[12px] text-[#8896A8] hover:text-[#4A5568] transition text-center">
          Skip — I'll connect my inbox later from Settings
        </button>
      </form>
    </div>
  );
}

// Step 4 — success
function StepSuccess({ email, onFinish }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-emerald-600">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      </div>

      <div>
        <h2 className="text-[22px] font-bold text-[#0D1525] tracking-tight">You're all set</h2>
        <p className="text-[13px] text-[#8896A8] mt-2">
          <span className="font-mono text-[#4A5568]">{email}</span> is now connected.
        </p>
        <p className="text-[13px] text-[#8896A8] mt-1 max-w-xs mx-auto leading-relaxed">
          Email attachments will be ingested and analysed automatically whenever you trigger a sync.
        </p>
      </div>

      <div className="bg-[#F0F4FA] border border-[#DDE3EE] rounded-xl p-4 text-left max-w-xs mx-auto">
        <p className="text-[11px] font-mono text-[#8896A8] uppercase tracking-wider mb-2">What happens next</p>
        <div className="space-y-2">
          {[
            "Go to Dashboard → click Sync Inbox",
            "Unread attachments are fetched",
            "AI pipeline runs in the background",
            "Documents appear in your repository",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#0D1525] text-[9px] font-bold font-mono text-[#00C2D4] flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-[12px] text-[#4A5568]">{s}</p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onFinish}
        className="w-full max-w-xs mx-auto block py-2.5 rounded-xl text-[13px] font-semibold bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] transition shadow-sm">
        Go to Dashboard →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main Onboarding page
// ─────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);           // 0 welcome | 1 provider | 2 creds | 3 success
  const [provider, setProvider] = useState(null);
  const [connectedEmail, setConnectedEmail] = useState("");

  const goToDashboard = () => navigate("/dashboard", { replace: true });

  const STEPS = ["Welcome", "Provider", "Credentials", "Done"];

  return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">

        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative w-8 h-8 rounded-xl bg-[#00C2D4]/15 border border-[#00C2D4]/25 flex items-center justify-center overflow-hidden ai-scan">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 relative z-10">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" fill="#00C2D4" fillOpacity=".9"/>
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-[#0D1525]">DocuFlow AI · KMRL</span>
        </div>

        {/* Progress indicator — only show for steps 1-3 */}
        {step > 0 && step < 3 && (
          <div className="flex items-center gap-2 mb-6">
            {STEPS.slice(1, 4).map((s, i) => {
              const idx = i + 1;
              const done = step > idx;
              const active = step === idx;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-1.5 shrink-0`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all
                      ${done ? "bg-emerald-500 text-white" : active ? "bg-[#0D1525] text-[#00C2D4]" : "bg-[#EEF2F8] text-[#C8D0DE]"}`}>
                      {done ? "✓" : idx}
                    </div>
                    <span className={`text-[11px] font-medium hidden sm:block
                      ${active ? "text-[#0D1525]" : done ? "text-emerald-600" : "text-[#C8D0DE]"}`}>
                      {s}
                    </span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-px ${done ? "bg-emerald-300" : "bg-[#EEF2F8]"}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div className="panel p-7 shadow-sm">
          {step === 0 && (
            <StepWelcome
              user={user}
              onNext={() => setStep(1)}
              onSkip={goToDashboard}
            />
          )}
          {step === 1 && (
            <StepProvider
              selected={provider}
              onSelect={setProvider}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && provider && (
            <StepCredentials
              provider={provider}
              onConnected={(email) => {
                setConnectedEmail(email || "");
                setStep(3);
              }}
              onBack={() => setStep(1)}
              onSkip={goToDashboard}
            />
          )}
          {step === 3 && (
            <StepSuccess
              email={connectedEmail}
              onFinish={goToDashboard}
            />
          )}
        </div>

        {/* Skip link always visible */}
        {step < 3 && (
          <p className="text-center mt-4 text-[12px] text-[#8896A8]">
            <button onClick={goToDashboard} className="hover:text-[#4A5568] transition">
              Skip setup and go to Dashboard →
            </button>
          </p>
        )}
      </div>
    </div>
  );
}