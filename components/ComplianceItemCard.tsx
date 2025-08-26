import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useToast } from './ToastProvider';
import TaskHistoryModal from './TaskHistoryModal';
import type { ComplianceObligation } from '../types';
import { createReminder } from '../services/remindersService';

const getStatusClasses = (status: ComplianceObligation['status']) => {
  switch (status) {
    case 'Cumplido':
      return 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30';
    case 'Pendiente':
      return 'bg-amber-400/20 text-amber-200 border border-amber-400/30';
    case 'Vencido':
      return 'bg-rose-500/20 text-rose-200 border border-rose-400/30';
    default:
      return 'bg-slate-400/10 text-slate-200 border border-white/10';
  }
};

const ComplianceItemCard: React.FC<{ item: ComplianceObligation; onCompleted?: (prevStatus: ComplianceObligation['status'], undo?: ()=>void) => void; recentlyCompleted?: boolean }> = ({ item, onCompleted, recentlyCompleted }) => {
  const [open, setOpen] = useState(false);
  const [localStatus] = useState<ComplianceObligation['status']>(item.status);
  const [anim, setAnim] = useState<'pulse'|'done'|null>(recentlyCompleted ? 'done' : null);
  const [showHistory, setShowHistory] = useState(false);
  const menuRef = useRef<HTMLDivElement|null>(null);
  const triggerRef = useRef<HTMLButtonElement|null>(null);
  const [menuPos, setMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
  const toast = useToast();
  // Cerrar por click afuera y recalcular posición
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      if(open) {
        if(menuRef.current && menuRef.current.contains(e.target as Node)) return;
        if(triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    const recalc = () => {
      if(!open || !triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + window.scrollY, left: r.right - 224 + window.scrollX, width: 224 }); // 224 = w-56
    };
    if(open){
      document.addEventListener('mousedown', handler);
      window.addEventListener('scroll', recalc, true);
      window.addEventListener('resize', recalc);
      recalc();
    }
    return ()=> {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

  const copyLink = () => {
    try {
      const url = window.location.origin + window.location.pathname + '?view=tareas&q=' + encodeURIComponent(item.name.slice(0,80));
      navigator.clipboard.writeText(url);
    } catch { /* ignore clipboard errors */ }
    setOpen(false);
  };

  const shareWhatsApp = () => {
    const text = `Obligación: ${item.name}\nVence: ${item.dueDate}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank','noopener');
    setOpen(false);
  };

  const goToTasks = () => {
    try {
      const base = new URL(window.location.href);
      base.searchParams.set('view','tareas');
      base.searchParams.set('q', item.name);
      window.history.pushState({}, '', base.toString());
      // Fire custom navigation event to ensure App updates even if listener logic changes
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'tareas', q: item.name }}));
    } catch { /* ignore */ }
    setOpen(false);
  };

  // Removed markCompleted and reopen actions (menu simplified)

  const scheduleReminder = async () => {
    try {
      await createReminder({ taskId: item.id, remindAt: item.rawDueISO ? item.rawDueISO + 'T09:00:00Z' : null, meta: { name: item.name } });
      setAnim('pulse');
      setTimeout(()=> setAnim(null), 1000);
      toast.addToast('info', 'Recordatorio guardado en la nube', 4000);
  try { window.dispatchEvent(new Event('reminders:changed')); } catch {/* ignore */}
    } catch(e:any){
      toast.addToast('error', 'No se pudo guardar el recordatorio: ' + (e?.message||'Error'), 6000);
    }
    setOpen(false);
  };

  const sendEmail = () => {
    const subj = `Seguimiento obligación: ${item.name.slice(0,80)}`;
    const body = `Detalle de obligación:\n\n${item.name}\nVencimiento: ${item.dueDate}\n\nAcciones sugeridas: revisar avance y evidencias.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    setOpen(false);
  };

  return (
    <div className={`glass p-4 rounded-lg shadow-sm border-l-4 border-brand-secondary flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 border border-white/10 relative transition z-10 ${open ? 'overflow-visible' : ''} ${anim==='pulse'?'animate-pulse':''} ${anim==='done'?'ring-2 ring-emerald-400/60':''} font-sans`}>
      <div className="flex-1">
        <h3 className="font-bold text-slate-100 text-lg">{item.name}</h3>
        <div className="flex items-center space-x-4 mt-2 text-sm text-slate-300">
          <span>
            <strong>Categoría:</strong> {item.category}
          </span>
          <span>
            <strong>Autoridad:</strong> {item.authority}
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-6 w-full sm:w-auto">
        <div className="text-sm">
          <p className="font-semibold text-slate-300">Vencimiento</p>
          <p className="text-slate-400">{item.dueDate}</p>
        </div>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusClasses(localStatus)}`}>
            {localStatus}
          </span>
          <div ref={menuRef} className="relative">
            <button ref={triggerRef} onClick={()=>setOpen(o=>!o)} className="text-slate-300 hover:text-white focus:outline-none relative z-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {open && menuPos && ReactDOM.createPortal(
              <div ref={menuRef} style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, position: 'absolute' }} className="rounded-md shadow-xl border border-white/10 bg-slate-800/95 backdrop-blur p-1 z-[9999] animate-fade-in">
                <button onClick={goToTasks} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-slate-200">Ver en Tareas</button>
                <button onClick={copyLink} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-slate-200">Copiar enlace</button>
                <button onClick={shareWhatsApp} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-slate-200">Compartir WhatsApp</button>
                <button onClick={sendEmail} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-slate-200">Enviar correo</button>
                <button onClick={()=>{ setShowHistory(true); setOpen(false); }} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-indigo-300">Historial & Recomendación</button>
                <button onClick={scheduleReminder} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-white/10 text-cyan-300">Programar recordatorio</button>
              </div>, document.body)
            }
            <TaskHistoryModal taskId={item.id} isOpen={showHistory} onClose={()=>setShowHistory(false)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceItemCard;