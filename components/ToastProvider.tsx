import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'error' | 'processing';
  message: string;
  ttl?: number; // ms
  actions?: ToastAction[]; // multiple actions supported
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string, ttl?: number, actions?: ToastAction | ToastAction[]) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: Toast['type'], message: string, ttl: number = 4000, actions?: ToastAction | ToastAction[]) => {
    const id = crypto.randomUUID();
    const arr = Array.isArray(actions) ? actions : actions ? [actions] : undefined;
    setToasts(prev => [...prev, { id, type, message, ttl, actions: arr }]);
    if (ttl > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, ttl);
    }
    return id;
  }, []);

  const clearToasts = useCallback(() => setToasts([]), []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <div className="fixed z-50 bottom-4 right-4 w-80 space-y-3">
        {toasts.map(t => (
          <div key={t.id} className={`relative rounded-md shadow-lg border text-sm animate-fade-in backdrop-blur flex flex-col gap-2 ${t.type==='processing' ? 'p-4 w-full max-w-lg bg-emerald-600 text-white border-emerald-700' : 'p-3 bg-white/90'} ${t.type==='success'?'border-emerald-300':'border-slate-300'} ${t.type==='error'?'border-red-300':''}`}> 
            <div className={`flex gap-2 items-start ${t.type==='processing' ? 'items-center' : ''}`}>
              <span className={`flex items-center gap-3 ${t.type==='processing' ? 'text-sm px-3 py-1 rounded-full bg-emerald-700/90' : 'text-xs px-2 py-0.5 rounded-full'} uppercase tracking-wide ${t.type==='success'?'bg-emerald-100 text-emerald-700': t.type==='error'?'bg-red-100 text-red-700': t.type==='processing' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {t.type==='processing' && (
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                )}
                <span>{t.type==='success'?'Éxito': t.type==='error'?'Error': t.type==='processing' ? 'INFO' : 'Info'}</span>
              </span>
              <span className={`${t.type==='processing' ? 'flex-1 text-base font-bold leading-tight' : 'flex-1 leading-snug text-slate-700 text-[13px]'}`}>{t.message}</span>
              <button onClick={()=>removeToast(t.id)} aria-label="Cerrar" className={`${t.type==='processing' ? 'text-white opacity-90 hover:opacity-100 ml-4' : 'text-slate-400 hover:text-slate-600 ml-2'}`}>&times;</button>
            </div>
            {t.actions && t.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {t.actions.map((a,i) => (
                  <button
                    key={i}
                    onClick={() => { try { a.onClick(); } finally { removeToast(t.id); } }}
                    className="text-xs font-semibold px-3 py-1 rounded-md text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                  >{a.label}</button>
                ))}
              </div>
            )}
            {t.type==='processing' ? (
              <div className="absolute left-0 bottom-0 h-0.5 bg-white/30 animate-pulse w-full" />
            ) : (
              <div className="absolute left-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-primary to-brand-secondary animate-pulse w-full" />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if(!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
};
