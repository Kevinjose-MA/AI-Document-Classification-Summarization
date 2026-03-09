// pages/EmailSettings.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../components/Toast";

// ─────────────────────────────────────────────────
// Provider presets — auto-fill IMAP host/port
// ─────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "gmail",
    label: "Google Workspace",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#EA4335" fillOpacity=".15" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "imap.gmail.com",
    imap_port: 993,
    hint: "Use a Google App Password — not your regular Gmail password.",
    helpUrl: "https://support.google.com/accounts/answer/185833",
    helpLabel: "How to create a Gmail App Password →",
    placeholder: "your@kmrl.co.in",
  },
  {
    id: "outlook",
    label: "Microsoft 365 / Outlook",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" fillOpacity=".12" stroke="#0078D4" strokeWidth="1.5"/>
        <path d="M2 8h20M8 4v16" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "outlook.office365.com",
    imap_port: 993,
    hint: "Use your Microsoft 365 email and password, or an App Password if MFA is enabled.",
    helpUrl: "https://support.microsoft.com/en-us/account-billing/app-passwords-a5817736-28b3-4f4c-8c7f-3a9da4174e96",
    helpLabel: "How to create a Microsoft App Password →",
    placeholder: "your@kmrl.co.in",
  },
  {
    id: "custom",
    label: "Custom / Corporate IMAP",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect x="2" y="6" width="20" height="12" rx="2" fill="#64748B" fillOpacity=".12" stroke="#64748B" strokeWidth="1.5"/>
        <path d="M2 10h20M6 6v12" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    imap_host: "",
    imap_port: 993,
    hint: "Enter your organisation's IMAP server details. Contact your IT team if unsure.",
    helpUrl: null,
    helpLabel: null,
    placeholder: "your@organisation.com",
  },
];

// ─────────────────────────────────────────────────
// Connected state card
// ─────────────────────────────────────────────────
function ConnectedCard({ status, onDisconnect, onSync, syncing }) {
  return (
    <div className="panel p-5 border-emerald-200">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-[#0D1525]">Inbox connected</p>
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ai-pulse" />
              Active
            </span>
          </div>
          <p className="text-[13px] text-[#4A5568] font-mono mt-0.5 truncate">{status.email}</p>
          {status.last_synced_at && (
            <p className="text-[11px] text-[#8896A8] mt-1 font-mono">
              Last synced:{" "}
              {new Date(status.last_synced_at).toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSync}
          disabled={syncing}
          className={`flex items-center gap-2 flex-1 justify-center py-2 rounded-xl text-[13px] font-semibold transition-all
            ${syncing
              ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
              : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98]"
            }`}
        >
          {syncing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Syncing inbox…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              Sync inbox now
            </>
          )}
        </button>
        <button
          onClick={onDisconnect}
          className="px-4 py-2 rounded-xl text-[13px] font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 transition"
        >
          Disconnect
        </button>
      </div>

      <p className="text-[11px] text-[#8896A8] font-mono mt-3 leading-relaxed">
        Syncing will fetch all unread email attachments from your inbox and ingest them
        through the AI pipeline automatically.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Connect form
// ─────────────────────────────────────────────────
function ConnectForm({ onConnected }) {
  const toast = useToast();
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const [form, setForm] = useState({
    email_address: "",
    email_password: "",
    imap_host: PROVIDERS[0].imap_host,
    imap_port: PROVIDERS[0].imap_port,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const selectProvider = (p) => {
    setSelectedProvider(p);
    setForm(f => ({
      ...f,
      imap_host: p.imap_host,
      imap_port: p.imap_port,
    }));
  };

  const set = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!form.email_address || !form.email_password || !form.imap_host) return;

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
      const msg = err.response?.data?.detail;
      if (typeof msg === "string" && msg.includes("Invalid email credentials")) {
        toast("Invalid credentials — check your email and app password", "error");
      } else if (typeof msg === "string" && msg.includes("Could not connect")) {
        toast("Could not reach mail server — check IMAP host and port", "error");
      } else {
        toast("Connection failed. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Provider selector */}
      <div>
        <p className="text-[11px] font-mono font-semibold text-[#8896A8] uppercase tracking-wider mb-2">
          Select your email provider
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => selectProvider(p)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all
                ${selectedProvider.id === p.id
                  ? "border-[#00C2D4] bg-[#00C2D4]/5 shadow-sm"
                  : "border-[#DDE3EE] bg-white hover:border-[#C8D0DE]"
                }`}
            >
              {p.icon}
              <span className="text-[11px] font-medium text-[#4A5568] leading-tight">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hint banner */}
      <div className="bg-[#F0F4FA] border border-[#DDE3EE] rounded-xl p-3.5 flex items-start gap-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#00C2D4] shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        <div>
          <p className="text-[12px] text-[#4A5568] leading-relaxed">{selectedProvider.hint}</p>
          {selectedProvider.helpUrl && (
            <a
              href={selectedProvider.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-[#00C2D4] hover:underline font-medium mt-1 inline-block"
            >
              {selectedProvider.helpLabel}
            </a>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleConnect} className="space-y-4">

        <div>
          <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">
            Email address
          </label>
          <input
            name="email_address"
            type="email"
            value={form.email_address}
            onChange={set}
            placeholder={selectedProvider.placeholder}
            className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                       placeholder:text-[#C8D0DE] transition"
          />
        </div>

        <div>
          <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">
            {selectedProvider.id === "custom" ? "Password" : "App Password"}
          </label>
          <div className="relative">
            <input
              name="email_password"
              type={showPassword ? "text" : "password"}
              value={form.email_password}
              onChange={set}
              placeholder="••••••••••••••••"
              className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                         focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                         placeholder:text-[#C8D0DE] transition pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8896A8] hover:text-[#4A5568] transition"
            >
              {showPassword
                ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                : <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Custom IMAP fields */}
        {selectedProvider.id === "custom" && (
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">IMAP Host</label>
              <input
                name="imap_host"
                type="text"
                value={form.imap_host}
                onChange={set}
                placeholder="mail.yourcompany.com"
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                           placeholder:text-[#C8D0DE] font-mono transition"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#4A5568] block mb-1.5">Port</label>
              <input
                name="imap_port"
                type="number"
                value={form.imap_port}
                onChange={set}
                className="w-full border border-[#DDE3EE] rounded-xl px-4 py-2.5 text-[13px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#00C2D4]/40 focus:border-[#00C2D4]
                           font-mono transition"
              />
            </div>
          </div>
        )}

        {/* IMAP details shown for non-custom (read-only, for transparency) */}
        {selectedProvider.id !== "custom" && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#8896A8] bg-[#F8FAFD] border border-[#EEF2F8] rounded-lg px-3 py-2">
            <span className="text-[#C8D0DE]">IMAP:</span>
            <span>{selectedProvider.imap_host}</span>
            <span className="text-[#C8D0DE]">·</span>
            <span>Port {selectedProvider.imap_port}</span>
            <span className="ml-auto text-[#00C2D4]">SSL/TLS</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.email_address || !form.email_password || !form.imap_host}
          className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
            ${loading || !form.email_address || !form.email_password || !form.imap_host
              ? "bg-[#F0F4FA] text-[#C8D0DE] border border-[#DDE3EE] cursor-not-allowed"
              : "bg-[#0D1525] text-white hover:bg-[#162035] active:scale-[0.98] shadow-sm"
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Verifying connection…
            </span>
          ) : "Connect inbox"}
        </button>
      </form>

      {/* Security note */}
      <div className="flex items-start gap-2 text-[11px] text-[#8896A8] font-mono leading-relaxed">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C8D0DE]">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
        </svg>
        Credentials are stored securely per-user and used only to fetch unread attachments
        via IMAP. Your password is never logged or shared.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main EmailSettings page
// ─────────────────────────────────────────────────
export default function EmailSettings() {
  const toast = useToast();
  const [status, setStatus] = useState(null);   // null = loading
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = () =>
    api.get("/email/status")
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ connected: false }));

  useEffect(() => { fetchStatus(); }, []);

  const handleDisconnect = async () => {
    try {
      await api.delete("/email/disconnect");
      toast("Inbox disconnected", "info");
      setStatus({ connected: false });
    } catch {
      toast("Failed to disconnect", "error");
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post("/documents/ingest-email");
      toast("Inbox sync started — attachments will appear in your repository shortly", "success");
    } catch (err) {
      toast(err.response?.data?.detail || "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="fade-up d1">
        <h1 className="text-[22px] font-semibold text-[#0D1525] tracking-tight">Email Inbox</h1>
        <p className="text-[12px] text-[#8896A8] mt-1 font-mono">
          Connect your corporate inbox to automatically ingest email attachments through the AI pipeline.
        </p>
      </div>

      {/* How it works strip */}
      <div className="fade-up d2 bg-[#0D1525] rounded-xl p-5">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-4">How email ingestion works</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            ["01", "Connect", "Link your IMAP inbox"],
            ["02", "Sync",    "Fetch unread attachments"],
            ["03", "Extract", "OCR + AI analysis runs"],
            ["04", "Route",   "Docs appear in repository"],
          ].map(([n, step, desc]) => (
            <div key={n} className="text-center">
              <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-2">
                <span className="text-[9px] font-mono font-bold text-[#00C2D4]">{n}</span>
              </div>
              <p className="text-[12px] font-medium text-white/80">{step}</p>
              <p className="text-[10px] font-mono text-white/30 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status / form */}
      <div className="fade-up d3">
        {status === null ? (
          <div className="panel p-8 flex items-center justify-center gap-3 text-[#8896A8]">
            <svg className="w-4 h-4 animate-spin text-[#00C2D4]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-[13px] font-mono">Checking inbox status…</span>
          </div>
        ) : status.connected ? (
          <ConnectedCard
            status={status}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            syncing={syncing}
          />
        ) : (
          <div className="panel p-6">
            <p className="text-[13px] font-semibold text-[#0D1525] mb-1">Connect your inbox</p>
            <p className="text-[12px] text-[#8896A8] mb-5">
              Link your corporate email so attachments are automatically ingested and analysed.
            </p>
            <ConnectForm onConnected={fetchStatus} />
          </div>
        )}
      </div>
    </div>
  );
}