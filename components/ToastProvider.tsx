import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'error';
  message: string;
  ttl?: number; // ms
  actions?: ToastAction[]; // multiple actions supported
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string, ttl?: number, actions?: ToastAction | ToastAction[]) => void;
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
  }, []);

  const clearToasts = useCallback(() => setToasts([]), []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <div className="fixed z-50 bottom-4 right-4 w-80 space-y-3">
        {toasts.map(t => (
          <div key={t.id} className={`relative p-3 rounded-md shadow-lg border text-sm animate-fade-in backdrop-blur bg-white/90 flex flex-col gap-2 ${t.type==='success'?'border-emerald-300':'border-slate-300'} ${t.type==='error'?'border-red-300':''}`}> 
            <div className="flex gap-2 items-start">
              <span className={`font-semibold text-xs px-2 py-0.5 rounded-full uppercase tracking-wide ${t.type==='success'?'bg-emerald-100 text-emerald-700': t.type==='error'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>{t.type==='success'?'Éxito': t.type==='error'?'Error':'Info'}</span>
              <span className="flex-1 leading-snug text-slate-700 text-[13px]">{t.message}</span>
              <button onClick={()=>removeToast(t.id)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 ml-2">&times;</button>
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
            <div className="absolute left-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-primary to-brand-secondary animate-pulse w-full" />
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
