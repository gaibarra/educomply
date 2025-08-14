import React, { useEffect, useState } from 'react';
import { listReminders } from '../services/remindersService';

interface ReminderRowUI {
  id: string;
  task_id: string;
  remind_at: string | null;
  created_at: string;
  meta: any | null;
}

const formatDateTime = (iso: string | null) => {
  if(!iso) return 'En fecha de vencimiento';
  try { return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
};

export const ReminderList: React.FC<{ limit?: number; className?: string; }> = ({ limit = 10, className }) => {
  const [reminders, setReminders] = useState<ReminderRowUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const all = await listReminders();
        const upcoming = all
          .sort((a:any,b:any)=>{
            const ta = a.remind_at ? new Date(a.remind_at).getTime() : Number.MAX_SAFE_INTEGER;
            const tb = b.remind_at ? new Date(b.remind_at).getTime() : Number.MAX_SAFE_INTEGER;
            return ta - tb;
          })
          .slice(0, limit);
        setReminders(upcoming as any);
      } catch(e:any){
        setError(e?.message||'Error');
      } finally { setLoading(false); }
    };
    load();
    const handler = () => load();
    window.addEventListener('reminders:changed', handler);
    return () => window.removeEventListener('reminders:changed', handler);
  }, [limit]);

  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">Próximos Recordatorios
        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300">{reminders.length}</span>
      </h4>
      {loading && <p className="text-xs text-slate-400">Cargando…</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!loading && !error && reminders.length === 0 && <p className="text-xs text-slate-500">Sin recordatorios.</p>}
      <ul className="space-y-1">
        {reminders.map(r => (
          <li key={r.id} className="text-xs flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-2 py-1">
            <span className="truncate max-w-[55%]" title={r.meta?.name || r.task_id}>{r.meta?.name || r.task_id}</span>
            <span className="text-slate-400">{formatDateTime(r.remind_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReminderList;
