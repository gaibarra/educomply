
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDebouncedEventQueue } from './hooks/useDebouncedEventQueue';
import { supabase } from '../services/supabaseClient';
import type { Profile, TaskFromDb, TaskScope, View } from '../types';

type LiteTask = Pick<TaskFromDb, 'id' | 'description' | 'created_at' | 'scope' | 'owner_id' | 'responsible_person_id'>;

// Date helpers
const startOfWeekMon = (date: Date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addWeeks = (date: Date, weeks: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

const diffInWeeks = (start: Date, end: Date) => {
  const ms = startOfWeekMon(end).getTime() - startOfWeekMon(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
};

const fmtWeek = (date: Date) =>
  date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

const isOverdue = (dueDate: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
};

const isNearDue = (dueDate: Date, days = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(today.getDate() + days);
  return dueDate >= today && dueDate <= soon;
};

const GanttView: React.FC<{ profile: Profile; setActiveView: (view: View) => void; setTaskSearchKeyword: (kw: string | null) => void; phoneCountryCodeDefault?: string }> = ({ profile, setActiveView, setTaskSearchKeyword, phoneCountryCodeDefault = '+52' }) => {
  const [tasks, setTasks] = useState<LiteTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllForAdmin, setShowAllForAdmin] = useState<boolean>(true);
  const [firstColWidth, setFirstColWidth] = useState<number>(360); // px
  const [spanWeeks, setSpanWeeks] = useState<number>(6);
  const [personsById, setPersonsById] = useState<Record<string, { name?: string; email?: string; mobile?: string }>>({}); // id -> person info
  const [searchTerm, setSearchTerm] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('tasks')
        .select('id, description, created_at, scope, owner_id, responsible_person_id')
        .order('scope->>due_date' as any, { ascending: true });

      const restrictToUser = profile.role !== 'admin' || !showAllForAdmin;
      if (restrictToUser) {
        query = query.or(`owner_id.eq.${profile.id},responsible_person_id.eq.${profile.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const onlyWithDueDate = (data as unknown as LiteTask[]).filter(
        t => (t.scope as unknown as TaskScope)?.due_date
      );
      setTasks(onlyWithDueDate);

      const personIds = Array.from(
        new Set(
          onlyWithDueDate.map(t => t.responsible_person_id).filter((v): v is string => Boolean(v))
        )
      );
      if (personIds.length > 0) {
        let map: Record<string, { name?: string; email?: string; mobile?: string }> = {};
        try {
          const { data: peopleWithEmail, error: errWithEmail } = await supabase
            .from('profiles')
            .select('id, full_name, email, mobile')
            .in('id', personIds);
          if (!errWithEmail && Array.isArray(peopleWithEmail)) {
            for (const p of peopleWithEmail as Array<{ id: string; full_name?: string; email?: string; mobile?: string }>) {
              map[p.id] = { name: p.full_name, email: p.email, mobile: p.mobile };
            }
            setPersonsById(map);
          } else if (errWithEmail) {
            const { data: people, error: peopleError } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', personIds);
            if (!peopleError && Array.isArray(people)) {
              map = {};
              for (const p of people as Array<{ id: string; full_name?: string }>) {
                map[p.id] = { name: p.full_name };
              }
              setPersonsById(map);
            } else if (peopleError) {
              console.warn('No se pudieron cargar responsables (opcional):', peopleError.message);
            }
          }
        } catch (err) {
          console.warn('Fallo al obtener email de responsables (opcional):', err);
        }
      } else {
        setPersonsById({});
      }
    } catch (e: any) {
      console.error('Error loading tasks for Gantt:', e);
      setError(e?.message ? `Error al cargar tareas: ${e.message}` : 'Error al cargar tareas.');
    } finally {
      setLoading(false);
    }
  }, [profile, showAllForAdmin]);

  // Initial fetch & refresh when profile or visibility changes
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Debounced queue for rapid status change events
  const enqueue = useDebouncedEventQueue<CustomEvent['detail']>(() => {
    setRefreshing(true);
    fetchTasks().finally(() => {
      // Keep spinner visible at least 300ms for perceived feedback
      setTimeout(()=> setRefreshing(false), 300);
    });
  }, 200);

  useEffect(() => {
    const listener = (e: Event) => {
      const ce = e as CustomEvent;
      enqueue(ce.detail);
    };
    window.addEventListener('task-status-changed', listener as EventListener);
    return () => window.removeEventListener('task-status-changed', listener as EventListener);
  }, [enqueue]);

  // Keyboard shortcut to focus search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const timeline = useMemo(() => {
    // Configurable X-week view starting this week
    const start = startOfWeekMon(new Date());
    const weeks = Array.from({ length: spanWeeks }, (_, i) => addWeeks(start, i));
    return { start, end: addWeeks(start, spanWeeks - 1), weeks };
  }, [spanWeeks]);

  const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const filteredTasks = useMemo(() => {
    const raw = searchTerm.trim();
    if (!raw) return tasks;
    const term = normalize(raw);
    return tasks.filter(t => {
      const desc = normalize(t.description || '');
      if (desc.includes(term)) return true;
      const scope = (t.scope as unknown as TaskScope) || ({} as TaskScope);
      if ([scope.category, scope.source, scope.level, scope.entity].some(f => normalize(f || '').includes(term))) return true;
      const resp = t.responsible_person_id ? personsById[t.responsible_person_id] : undefined;
      if (resp?.name && normalize(resp.name).includes(term)) return true;
      if (resp?.email && normalize(resp.email).includes(term)) return true;
      return false;
    });
  }, [tasks, searchTerm, personsById]);

  const highlightMatch = (text: string) => {
    if (!searchTerm.trim()) return text;
    const term = searchTerm.trim();
    try {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'ig');
      return text.split(regex).reduce<React.ReactNode[]>((acc, part, idx, arr) => {
        acc.push(part);
        if (idx < arr.length - 1) {
          const match = text.match(regex)?.[0] || term;
          acc.push(<mark key={idx} className="bg-amber-400/60 text-slate-900 px-0.5 rounded-sm">{match}</mark>);
        }
        return acc;
      }, []);
    } catch {
      return text;
    }
  };

  const getBarPlacement = (t: LiteTask) => {
    const startDate = new Date(t.created_at);
    const dueDate = new Date(((t.scope as unknown as TaskScope)!.due_date as string) + 'T00:00:00');
    const startIdx = Math.max(0, diffInWeeks(timeline.start, startDate));
    const endIdx = Math.max(startIdx, diffInWeeks(timeline.start, dueDate));
    const span = endIdx - startIdx + 1;
    return { startIdx, span, dueDate };
  };

  const gridTemplateColumns = useMemo(() => {
    // First column resizable in px, then one column per week
    return `${firstColWidth}px repeat(${timeline.weeks.length}, minmax(80px, 1fr))`;
  }, [timeline.weeks.length, firstColWidth]);

  const buildMailto = (email: string, t: LiteTask, due: string) => {
    const scope = (t.scope as unknown as TaskScope) || ({} as TaskScope);
    const subject = `Seguimiento de tarea: ${t.description.slice(0, 100)} (vence: ${due})`;
    const appUrl = (() => {
      try {
        const base = window.location.origin + window.location.pathname;
        const url = new URL(base);
        url.searchParams.set('view', 'tareas');
        url.searchParams.set('q', t.description);
        return url.toString();
      } catch {
        return '';
      }
    })();
    const body = `Hola,%0D%0A%0D%0A` +
      `Te contacto para dar seguimiento a la siguiente obligación de cumplimiento:%0D%0A%0D%0A` +
      `• Tarea: ${t.description}%0D%0A` +
      `• Vencimiento: ${due}%0D%0A` +
      (scope?.category ? `• Categoría: ${scope.category}%0D%0A` : '') +
      (scope?.source ? `• Autoridad/Fuente: ${scope.source}%0D%0A` : '') +
      (scope?.level ? `• Ámbito: ${scope.level}%0D%0A` : '') +
      (scope?.entity ? `• Entidad: ${scope.entity}%0D%0A` : '') +
      (appUrl ? `%0D%0AEnlace directo a la tarea: ${encodeURIComponent(appUrl)}%0D%0A` : '') +
      `%0D%0APor favor confirma recepción y próximos pasos. Gracias.`;
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  const buildAppUrl = (t: LiteTask) => {
    try {
      const base = window.location.origin + window.location.pathname;
      const url = new URL(base);
      url.searchParams.set('view', 'tareas');
      url.searchParams.set('q', t.description);
      return url.toString();
    } catch {
      return '';
    }
  };

  const buildShareText = (t: LiteTask, due: string) => {
    const scope = (t.scope as unknown as TaskScope) || ({} as TaskScope);
    let text = `Seguimiento de tarea\n` +
      `• Tarea: ${t.description}\n` +
      `• Vencimiento: ${due}\n`;
    if (scope?.category) text += `• Categoría: ${scope.category}\n`;
    if (scope?.source) text += `• Autoridad/Fuente: ${scope.source}\n`;
    if (scope?.level) text += `• Ámbito: ${scope.level}\n`;
    if (scope?.entity) text += `• Entidad: ${scope.entity}\n`;
    const appUrl = buildAppUrl(t);
    if (appUrl) text += `\nEnlace directo: ${appUrl}`;
    return text;
  };

  const normalizeToE164 = (raw: string | undefined, defaultCountry: string = phoneCountryCodeDefault): string | null => {
    if (!raw) return null;
    let s = raw.trim();
    if (s.startsWith('00')) s = '+' + s.slice(2);
    // Keep leading + and digits only
    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('+')) {
      const digits = s.slice(1);
      if (digits.length >= 8) return '+' + digits; // minimal sanity
      return null;
    }
    // No leading +
    const digitsOnly = s.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      // Assume local MX 10-digit number
      return defaultCountry + digitsOnly;
    }
    if (digitsOnly.length > 10) {
      return '+' + digitsOnly;
    }
    return null;
  };

  const buildWhatsAppLink = (mobile: string | undefined, t: LiteTask, due: string) => {
    const text = buildShareText(t, due);
    const phone = normalizeToE164(mobile) || '';
    const base = 'https://wa.me/';
    const path = phone ? `${phone}` : '';
    return `${base}${path}?text=${encodeURIComponent(text)}`;
  };

  const buildTelegramLink = (t: LiteTask, due: string) => {
    const text = buildShareText(t, due);
    const appUrl = buildAppUrl(t);
    const base = 'https://t.me/share/url';
    const params = `?url=${encodeURIComponent(appUrl || '')}&text=${encodeURIComponent(text)}`;
    return `${base}${params}`;
  };

  const handleGoToTask = useCallback((taskTitle: string) => {
    // Pass the task title as a keyword to Tareas and navigate.
    setTaskSearchKeyword(taskTitle);
    setActiveView('tareas');
  }, [setActiveView, setTaskSearchKeyword]);

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-2">Gráfica de Gantt</h2>
      <p className="text-slate-300 mb-6">Visualiza las tareas desde su creación hasta la fecha de vencimiento.</p>
      {/* Version tag & debug */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center text-[10px] font-semibold tracking-wide uppercase bg-brand-primary/20 text-cyan-200 px-2 py-0.5 rounded">Gantt v2 búsqueda</span>
        <span className="text-[10px] text-slate-500">Atajos: / o Ctrl+K</span>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {/* Compact search row (visible siempre) */}
        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2 border border-white/15 shadow-sm">
          <div className="flex items-center gap-2 w-full">
            <span className="text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar título, categoría, fuente, ámbito, entidad o responsable"
              className="flex-1 bg-transparent placeholder-slate-500 text-sm text-slate-100 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                className="text-[11px] font-medium text-slate-300 hover:text-white px-2 py-0.5 rounded-md border border-white/10 bg-white/5"
              >Limpiar</button>
            )}
            <span className="text-[11px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 min-w-[54px] text-center">
              {filteredTasks.length}/{tasks.length}
            </span>
          </div>
        </div>
        {profile.role === 'admin' && (
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
          <input
            id="toggleAllTasksGantt"
            type="checkbox"
            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-slate-300 rounded"
            checked={showAllForAdmin}
            onChange={e => setShowAllForAdmin(e.target.checked)}
          />
          <label htmlFor="toggleAllTasksGantt" className="text-sm text-slate-300 select-none">
            Ver todas las tareas (Admin)
          </label>
          <span className="text-xs text-slate-400 ml-auto">
            {showAllForAdmin ? 'Mostrando global' : 'Mostrando propias/asignadas'}
          </span>
        </div>)}

        <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
          <label className="text-sm text-slate-300 select-none">Ancho columna tareas</label>
          <input
            type="range"
            min={240}
            max={640}
            step={10}
            value={firstColWidth}
            onChange={(e) => setFirstColWidth(Number(e.target.value))}
            className="w-48"
          />
          <span className="text-xs text-slate-400">{firstColWidth}px</span>
        </div>

        <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
          <label className="text-sm text-slate-300 select-none">Semanas visibles</label>
          <input
            type="range"
            min={4}
            max={12}
            step={1}
            value={spanWeeks}
            onChange={(e) => setSpanWeeks(Number(e.target.value))}
            className="w-48"
          />
          <span className="text-xs text-slate-400">{spanWeeks} semanas</span>
        </div>
      </div>

      {(loading || refreshing) && (
        <div className="flex justify-center items-center p-4" aria-live="polite">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-primary border-t-transparent"></div>
            <span>{loading ? 'Cargando tareas...' : 'Actualizando...'}</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 p-8 rounded-xl shadow-md text-center text-red-700">
          <h3 className="mt-2 text-lg font-semibold">{error}</h3>
        </div>
      )}

      {!loading && !error && (
        <div className="glass p-4 md:p-6 rounded-xl border border-white/10">
          {refreshing && (
            <div className="absolute inset-0 rounded-xl bg-slate-900/30 backdrop-blur-[2px] flex items-start justify-end p-2 pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-800/70 border border-white/10 px-3 py-1 rounded-md text-xs text-slate-300 shadow-sm">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-cyan-400 border-t-transparent" />
                Actualizando
              </div>
            </div>
          )}
          {/* Keyboard shortcuts for focusing search */}
          <div className="hidden" aria-hidden="true" />
          {/* Header timeline */}
          <div
            className="grid text-xs md:text-sm font-semibold text-slate-300 sticky top-0 z-20 backdrop-blur bg-[#0b1e3a]/80 border-b border-white/10 shadow-sm"
            style={{ gridTemplateColumns }}
          >
            <div className="px-2 py-2">Tarea</div>
            {timeline.weeks.map((w, i) => (
              <div key={i} className="px-1 py-2 text-center">
                {fmtWeek(w)}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="mt-2 space-y-2">
            {filteredTasks.length === 0 && (
              <div className="text-slate-400 text-center p-6">
                {searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'No hay tareas con fecha de vencimiento.'}
              </div>
            )}

            {filteredTasks.map(t => {
              const { startIdx, span, dueDate } = getBarPlacement(t);
              const due = dueDate.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
              const overdue = isOverdue(dueDate);
              const near = isNearDue(dueDate);
              const barColor = overdue
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : near
                ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                : 'linear-gradient(135deg, #3b82f6, #06b6d4)';

              return (
                <div
                  key={t.id}
                  className="grid items-center relative"
                  style={{ gridTemplateColumns }}
                >
                  <div className="px-2 py-2 text-slate-200">
                    <div className="font-medium text-slate-100 whitespace-normal break-words pr-2" title={t.description}>{highlightMatch(t.description)}</div>
                    <div className="text-xs text-slate-400">Vence: {due}</div>
                    {(() => {
                      const info = t.responsible_person_id ? personsById[t.responsible_person_id] : undefined;
                      const candidateEmail = info?.email || (t.responsible_person_id && t.responsible_person_id.includes('@') ? t.responsible_person_id : undefined);
            const mailto = buildMailto(candidateEmail || '', t, due);
                      const nameOrDash = info?.name || 'Sin asignar';
            const wa = buildWhatsAppLink(info?.mobile, t, due);
            const tg = buildTelegramLink(t, due);
                      return (
                        <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                          <span>Responsable: {candidateEmail ? (
                            <a href={mailto} className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">{candidateEmail}</a>
                          ) : (
                            <span>{nameOrDash}</span>
                          )}</span>
                          {info?.name && candidateEmail ? <span className="text-slate-400">· {info.name}</span> : null}
                          {!candidateEmail && (
                            <a href={mailto} className="ml-1 text-cyan-300 hover:text-cyan-200 underline underline-offset-2">Enviar correo</a>
                          )}
              <span className="text-slate-500">·</span>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline underline-offset-2">WhatsApp</a>
              <span className="text-slate-500">·</span>
              <a href={tg} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 underline underline-offset-2">Telegram</a>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Week cells to draw the grid lines */}
                  {timeline.weeks.map((_, i) => (
                    <div key={i} className="min-h-10 border-l border-white/5 py-2" />
                  ))}

                  {/* Bar */}
                  <div
                    title={`Vence: ${due}`}
                    className="h-3 rounded-full shadow-md"
                    style={{
                      gridColumn: `${startIdx + 2} / span ${span}`,
                      background: barColor,
                    }}
                  />

                  {/* Row actions */}
                  <div className="col-span-full -mt-2 px-2 pb-3">
                    <button
                      onClick={() => handleGoToTask(t.description)}
                      className="mt-2 text-xs font-semibold text-white px-3 py-1 rounded-md"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #3b82f6)' }}
                    >
                      Ir a tarea
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{background: 'linear-gradient(135deg, #3b82f6, #06b6d4)'}}></span>En plazo</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{background: 'linear-gradient(135deg, #f59e0b, #f97316)'}}></span>Próximo a vencer</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)'}}></span>Atrasada</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttView;
