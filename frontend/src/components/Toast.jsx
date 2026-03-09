// components/Toast.jsx
import { createContext, useContext, useState, useCallback } from "react";

const TC = createContext(null);

const CONF = {
  success: { bar: "bg-emerald-500", icon: "✓", iconBg: "bg-emerald-500" },
  error:   { bar: "bg-red-500",     icon: "✕", iconBg: "bg-red-500"     },
  warning: { bar: "bg-amber-400",   icon: "!", iconBg: "bg-amber-400"   },
  info:    { bar: "bg-[#00C2D4]",   icon: "i", iconBg: "bg-[#00C2D4]"  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  return (
    <TC.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const c = CONF[t.type] || CONF.info;
          return (
            <div key={t.id}
              className="toast-in pointer-events-auto flex items-stretch bg-white rounded-xl border border-[#DDE3EE] shadow-lg overflow-hidden min-w-[300px] max-w-[380px]">
              <div className={`w-1 shrink-0 ${c.bar}`} />
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`w-5 h-5 rounded-full ${c.iconBg} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                  {c.icon}
                </span>
                <span className="text-[13px] font-medium text-slate-700 leading-snug">{t.msg}</span>
              </div>
            </div>
          );
        })}
      </div>
    </TC.Provider>
  );
}

export const useToast = () => useContext(TC).toast;