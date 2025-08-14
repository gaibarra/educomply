import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabaseClient';

interface EventItem {
  ts: string;      // ISO timestamp
  type: string;    // event type identifier
  title: string;   // human readable title
  detail?: string; // optional detail / description
  subTaskId?: string;
}

interface TaskHistoryModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Heuristic fallback recommendation builder (local)
function buildRecommendation(events: EventItem[], dueDate: string | null): string {
  if (!events.length) return 'Sin eventos: defina subtareas y adjunte evidencia inicial para establecer trazabilidad.';
  const subTasks = events.filter(e => e.type === 'subtask');
  const comments = events.filter(e => e.type === 'comment');
  const docs = events.filter(e => e.type === 'document');
  const completed = events.find(e => e.type === 'task-completed');
  const creation = events.find(e => e.type === 'task-created');
  let remainingDays: number | null = null;
  if (dueDate) remainingDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  const lines: string[] = [];
  if (creation) lines.push('Seguimiento desde ' + new Date(creation.ts).toLocaleDateString());
  if (remainingDays != null) {
    if (remainingDays < 0) lines.push('VENCIDA: ' + Math.abs(remainingDays) + ' días de atraso. Priorizar regularización.');
    else if (remainingDays <= 7) lines.push('Urgente: ' + remainingDays + ' días restantes. Acelerar cierre.');
    else lines.push('Tiempo restante: ' + remainingDays + ' días. Mantener ritmo.');
  }
  if (!subTasks.length) lines.push('Sin subtareas: crear unidades de trabajo claras.');
  else lines.push('Subtareas registradas: ' + subTasks.length + (completed ? ' (marcada completada)' : ''));
  if (!docs.length) lines.push('Falta evidencia documental: adjuntar soportes de cumplimiento.');
  if (comments.length) lines.push('Colaboración activa: ' + comments.length + ' comentarios.');
  if (completed) lines.push('Validar consistencia documental y cerrar formalmente.');
  else lines.push('Revisar riesgos residuales antes de marcar como completada.');
  return lines.join('\n');
}

const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({ taskId, isOpen, onClose }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const typeMeta = (type: string) => {
    // normalize underscores
    const t = type.toLowerCase();
    switch (t) {
      case 'task-created':
        return {
          circle: 'from-emerald-500 to-emerald-600',
          chip: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 01.894.553l1.382 2.763 3.05.443a1 1 0 01.554 1.705l-2.206 2.15.521 3.033a1 1 0 01-1.451 1.054L10 12.347l-2.744 1.445a1 1 0 01-1.45-1.055l.52-3.032L4.12 7.464a1 1 0 01.554-1.705l3.05-.443 1.382-2.763A1 1 0 0110 2z"/></svg>
          )
        };
      case 'task-completed':
        return {
          circle: 'from-emerald-400 to-lime-500',
            chip: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd"/></svg>
          )
        };
      case 'subtask':
        return {
          circle: 'from-sky-500 to-indigo-500',
          chip: 'bg-sky-500/15 text-sky-200 border border-sky-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h9M6 12h9M6 18h9M18 6v12"/></svg>
          )
        };
      case 'comment':
        return {
          circle: 'from-orange-500 to-amber-500',
          chip: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2z"/></svg>
          )
        };
      case 'document':
        return {
          circle: 'from-fuchsia-500 to-purple-600',
          chip: 'bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 2a2 2 0 00-2 2v12c0 1.103.897 2 2 2h12a2 2 0 002-2V7.828A2 2 0 0017.414 6L12 0H4zm8 1.5L15.5 7H12V3.5z"/></svg>
          )
        };
      default:
        return {
          circle: 'from-slate-500 to-slate-600',
          chip: 'bg-slate-500/15 text-slate-200 border border-slate-400/30',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.75a.75.75 0 00-1.5 0v4.5c0 .414.336.75.75.75h3a.75.75 0 000-1.5h-2.25v-3.75z" clipRule="evenodd"/></svg>
          )
        };
    }
  };

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setAiRecommendation(null);
    try {
      const { data: task, error: taskErr } = await supabase
        .from('tasks')
        .select('id, created_at, description, scope, completed_at, completed_by')
        .eq('id', taskId)
        .maybeSingle();
      if (taskErr) throw taskErr;
      const evts: EventItem[] = [];
      if (task) {
        evts.push({ ts: task.created_at, type: 'task-created', title: 'Creación de la tarea', detail: task.description });
        const scopeDue = (task.scope as any)?.due_date || (task.scope as any)?.dueDate || null;
        if (scopeDue) setDueDate(scopeDue);
        if (task.completed_at) evts.push({ ts: task.completed_at, type: 'task-completed', title: 'Tarea marcada como completada' });
      }
      // Subtasks
      const { data: subs, error: subsErr } = await supabase
        .from('sub_tasks')
        .select('id, created_at, description, status')
        .eq('task_id', taskId)
        .order('created_at');
      if (subsErr) throw subsErr;
      const subIds = (subs || []).map(s => s.id);
      for (const s of subs || []) {
        evts.push({ ts: s.created_at, type: 'subtask', title: 'Subtarea creada', detail: `${s.description} [${s.status}]`, subTaskId: s.id });
      }
      if (subIds.length) {
        const { data: comments, error: cErr } = await supabase
          .from('comments')
          .select('id, created_at, text, sub_task_id, author_name')
          .in('sub_task_id', subIds)
          .order('created_at');
        if (cErr) throw cErr;
        for (const c of comments || []) {
          evts.push({ ts: c.created_at, type: 'comment', title: `Comentario (${c.author_name || 'Autor desconocido'})`, detail: c.text, subTaskId: c.sub_task_id });
        }
        const { data: docs, error: dErr } = await supabase
          .from('documents')
          .select('id, created_at, name, sub_task_id')
          .in('sub_task_id', subIds)
          .order('created_at');
        if (dErr) throw dErr;
        for (const d of docs || []) {
          evts.push({ ts: d.created_at, type: 'document', title: 'Documento adjuntado', detail: d.name, subTaskId: d.sub_task_id });
        }
      }
      // Optional activity log
      try {
        const { data: activityLog, error: actErr } = await supabase
          .from('task_activity_log' as any)
          .select('created_at, event_type, detail')
          .eq('task_id', taskId)
          .order('created_at');
        if (!actErr && Array.isArray(activityLog)) {
          for (const a of activityLog) {
            evts.push({ ts: a.created_at, type: a.event_type, title: a.event_type.replace(/_/g, ' '), detail: a.detail });
          }
        }
      } catch { /* table may not exist */ }
      evts.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      setEvents(evts);
      if (evts.length) {
        setAiLoading(true);
        (async () => {
          try {
            const body = {
              events: evts.map(e => ({ ts: e.ts, type: e.type, title: e.title, detail: e.detail })),
              context: { description: task?.description, category: (task?.scope as any)?.category, source: (task?.scope as any)?.source }
            };
            const { data, error: fxErr } = await supabase.functions.invoke('task-history-recommendation', { body });
            if (!fxErr && data?.recommendation) setAiRecommendation(data.recommendation);
            else if (fxErr) console.warn('[TaskHistoryModal] recommendation edge error', fxErr.message);
          } catch (e: any) {
            console.warn('[TaskHistoryModal] invoke recommendation failed', e?.message);
          } finally { setAiLoading(false); }
        })();
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar historial');
    } finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { if (isOpen) fetchData(); }, [isOpen, fetchData]);

  const recommendation = useMemo(() => buildRecommendation(events, dueDate), [events, dueDate]);

  // Build shareable plain-text summary (memoized)
  const shareSummary = useMemo(() => {
    const header = `Historial de Actividad - Tarea ${taskId}`;
    const rec = (aiRecommendation || recommendation) || '';
    const eventLines = events.slice(-10).map(e => {
      const ts = new Date(e.ts).toLocaleString();
      return `• [${ts}] ${e.title}${e.detail ? ': ' + e.detail.replace(/\n+/g,' ') : ''}`;
    });
    return [header, '', 'Últimos eventos:', ...eventLines, '', 'Recomendación:', rec].join('\n');
  }, [taskId, events, aiRecommendation, recommendation]);

  const openWindowSafe = (url: string) => {
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {/* ignore */}
  };

  const handleSendEmail = useCallback(() => {
    const subject = encodeURIComponent(`Historial Tarea ${taskId}`);
    const body = encodeURIComponent(shareSummary);
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    openWindowSafe(mailto);
  }, [shareSummary, taskId]);

  const handleSendWhatsApp = useCallback(() => {
    const text = encodeURIComponent(shareSummary);
    const url = `https://wa.me/?text=${text}`;
    openWindowSafe(url);
  }, [shareSummary]);

  const handleSendTelegram = useCallback(() => {
    const text = encodeURIComponent(shareSummary);
    // If there is a canonical app URL for the task it could be appended as &url=...
    const url = `https://t.me/share/url?text=${text}`;
    openWindowSafe(url);
  }, [shareSummary]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-start md:items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 md:p-8 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl glass rounded-2xl shadow-2xl flex flex-col max-h-[92vh] border border-white/10 animate-slide-up-fade">
        {/* Header */}
        <div className="px-6 md:px-8 py-5 flex items-start justify-between bg-gradient-to-r from-brand-primary/30 to-brand-secondary/20 rounded-t-2xl border-b border-white/10">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-gradient">Historial de Actividad & Recomendación</h2>
            <p className="mt-1 text-xs md:text-sm text-slate-300 max-w-2xl">Cronología consolidada de la tarea y sus subtareas para soporte de decisiones de cumplimiento.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="ml-4 text-slate-300 hover:text-white transition-colors rounded-full p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
        {/* Content */}
        <div className="px-6 md:px-8 py-6 overflow-y-auto space-y-8">
          {loading && <p className="text-sm text-slate-400">Cargando historial...</p>}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {!loading && !error && (
            <>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-brand-secondary animate-pulse" />
                  Línea de Tiempo
                </h3>
                <ol className="relative border-l border-slate-500/30 pl-5 space-y-7">
                  {events.map((ev, idx) => {
                    const meta = typeMeta(ev.type);
                    const long = ev.detail && ev.detail.length > 220;
                    const expandedFlag = expanded.has(idx);
                    const displayDetail = ev.detail ? (expandedFlag || !long ? ev.detail : ev.detail.slice(0,200) + '…') : null;
                    return (
                      <li key={idx} className="ml-2 group">
                        <div className={`absolute -left-[10px] top-1.5 w-4 h-4 rounded-full bg-gradient-to-br ${meta.circle} border border-white/20 shadow ring-2 ring-white/10 flex items-center justify-center text-[9px] text-white group-hover:scale-110 transition-transform`}>{meta.icon}</div>
                        <div className="flex flex-col gap-1 bg-white/5 dark:bg-slate-700/20 rounded-lg p-3 border border-white/10 backdrop-blur-sm hover:border-brand-secondary/40 transition-colors">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-medium tracking-wide uppercase text-brand-accent/90 bg-brand-accent/10 px-2 py-0.5 rounded-full">{new Date(ev.ts).toLocaleString()}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.chip}`}>{ev.type.replace(/_/g,' ')}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-100 flex items-start gap-2">
                            {meta.icon && <span className="hidden" aria-hidden> </span>}{ev.title}
                          </p>
                          {displayDetail && (
                            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {displayDetail}
                              {long && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(idx)}
                                  className="ml-2 text-[10px] font-semibold text-brand-accent hover:underline focus:outline-none"
                                >{expandedFlag ? 'ver menos' : 'ver más'}</button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {events.length === 0 && <p className="text-sm text-slate-400">No se registraron eventos.</p>}
                </ol>
              </section>
              <section className="pt-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-accent" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14A1 1 0 003 18h14a1 1 0 00.894-1.447l-7-14zM11 14H9v-2h2v2zm0-4H9V6h2v4z" /></svg>
                  Recomendación Ejecutiva
                </h3>
                <div className="relative rounded-lg bg-slate-800/40 border border-white/10 p-5 shadow-inner">
                  {aiLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-lg">
                      <span className="text-xs text-slate-300 animate-pulse">Generando recomendación IA...</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-slate-100 pr-1 whitespace-pre-wrap">
                    {aiRecommendation || recommendation}
                  </p>
                  <p className="mt-3 text-[11px] text-slate-400 italic">
                    {aiRecommendation ? 'Generado por modelo IA (Gemini) con énfasis normativo.' : 'Fallback heurístico local (IA no disponible).'}
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
        {/* Footer */}
        <div className="px-6 md:px-8 py-4 border-t border-white/10 flex flex-wrap gap-3 justify-end rounded-b-2xl bg-slate-900/40">
          <button onClick={handleSendEmail} className="px-4 py-2 text-xs md:text-sm font-medium rounded-lg bg-slate-700/60 text-slate-100 hover:bg-slate-600/70 border border-slate-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60 transition">
            Enviar por Email
          </button>
          <button onClick={handleSendWhatsApp} className="px-4 py-2 text-xs md:text-sm font-medium rounded-lg bg-emerald-600/80 text-white hover:bg-emerald-600 border border-emerald-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 transition">
            Enviar WhatsApp
          </button>
          <button onClick={handleSendTelegram} className="px-4 py-2 text-xs md:text-sm font-medium rounded-lg bg-sky-600/80 text-white hover:bg-sky-600 border border-sky-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 transition">
            Enviar Telegram
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60 transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  // Portal to body to avoid ancestor stacking contexts interfering with z-index
  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body);
  }
  return modalContent;
};

export default TaskHistoryModal;
