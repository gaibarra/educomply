

import React, { useState, useEffect, useRef } from 'react';
import KpiCard from './KpiCard';
import ComplianceItemCard from './ComplianceItemCard';
import SearchBar from './SearchBar';
import { useToast } from './ToastProvider';
import type { Kpi, ComplianceObligation, Profile, View, TaskOverallStatus, TaskScope, TaskFromDb } from '../types';
import { supabase } from '../services/supabaseClient';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import ReminderList from './ReminderList';

const icons = [
    <ShieldCheckIcon key="shield" className="w-7 h-7 text-brand-secondary" />,
    <ClipboardCheckIcon key="clip" className="w-7 h-7 text-brand-secondary" />,
    <ChartBarIcon key="chart" className="w-7 h-7 text-brand-secondary" />,
    <BookOpenIcon key="book" className="w-7 h-7 text-brand-secondary" />,
];

const getTaskStatus = (task: { scope: any | null; subTasks: { status: string }[] | null }): TaskOverallStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateStr = (task.scope as unknown as TaskScope)?.due_date;
    if (task.subTasks && task.subTasks.length > 0) {
        const allCompleted = task.subTasks.every(st => st.status === 'Completada');
        if (allCompleted) return 'Completada';
        if (dueDateStr) {
            const dueDate = new Date(dueDateStr + 'T00:00:00');
            if (dueDate < today) return 'Atrasada';
        }
        const someProgress = task.subTasks.some(st => st.status !== 'Pendiente');
        if (someProgress) return 'En Progreso';
    } else if (dueDateStr) {
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        if (dueDate < today) return 'Atrasada';
    }
    return 'Pendiente';
};


const Dashboard: React.FC<{ profile: Profile; setActiveView: (view: View) => void; institutionProfile?: any | null; setTareasInitialKeyword?: (kw: string | null) => void }> = ({ profile, setActiveView, setTareasInitialKeyword }) => {
    const [kpis, setKpis] = useState<Kpi[]>([]);
    const [pendingObligations, setPendingObligations] = useState<ComplianceObligation[]>([]);
    const [page, setPage] = useState(0); // paginación para obligaciones críticas
    const pageSize = 10;
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [obligationFilter] = useState<'Todas' | 'Pendiente' | 'Vencido'>('Todas');
    const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
        const recentlyCompleted = useRef<Set<string>>(new Set());
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [, setFiltersOpen] = useState(false);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setFetchError(null);
            try {
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('id, description, scope')
                    .order('scope->>due_date' as any, { ascending: true });
                if (tasksError) throw tasksError;
                const typedTasksData = tasksData as unknown as (Pick<TaskFromDb, 'id' | 'description' | 'scope'>[] | null);
                const taskIds = (typedTasksData || []).map(t => t.id);
                if (taskIds.length === 0) {
                    setKpis([
                        { title: 'Cumplimiento General', value: '100%', change: 'N/A', changeType: 'increase' },
                        { title: 'Tareas Pendientes', value: '0', change: 'N/A', changeType: 'decrease' },
                        { title: 'Tareas Atrasadas', value: '0', change: 'N/A', changeType: 'decrease' },
                        { title: 'Total de Tareas', value: '0', change: 'N/A', changeType: 'increase' },
                    ]);
                    setPendingObligations([]);
                    setLoading(false);
                    return;
                }
                const { data: subTasksData, error: subTasksError } = await supabase
                    .from('sub_tasks')
                    .select('task_id, status')
                    .in('task_id', taskIds);
                if (subTasksError) throw subTasksError;
                const typedSubTasksData = subTasksData as unknown as ({ task_id: string; status: string }[] | null);
                const subTasksByTaskId = (typedSubTasksData || []).reduce((acc: Record<string, { status: string }[]>, st) => {
                    acc[st.task_id] = acc[st.task_id] || [];
                    acc[st.task_id].push(st);
                    return acc;
                }, {});
                const combinedTasks = (typedTasksData || []).map(t => ({ ...t, subTasks: subTasksByTaskId[t.id] || [] }));
                const tasksWithStatus = combinedTasks.map(t => ({ ...t, overallStatus: getTaskStatus(t) }));
                const totalTasks = tasksWithStatus.length;
                const completedTasks = tasksWithStatus.filter(t => t.overallStatus === 'Completada').length;
                const pendingTasks = tasksWithStatus.filter(t => ['Pendiente', 'En Progreso'].includes(t.overallStatus)).length;
                const overdueTasks = tasksWithStatus.filter(t => t.overallStatus === 'Atrasada').length;
                const complianceRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : '100';
                setKpis([
                    { title: 'Cumplimiento General', value: `${complianceRate}%`, change: 'N/A', changeType: 'increase' },
                    { title: 'Tareas Pendientes', value: pendingTasks.toString(), change: 'N/A', changeType: 'decrease' },
                    { title: 'Tareas Atrasadas', value: overdueTasks.toString(), change: 'N/A', changeType: 'decrease' },
                    { title: 'Total de Tareas', value: totalTasks.toString(), change: 'N/A', changeType: 'increase' },
                ]);
                const criticalObligations = tasksWithStatus
                    .filter(t => t.overallStatus === 'Pendiente' || t.overallStatus === 'Atrasada')
                    .map(
                        (t): ComplianceObligation => ({
                            id: String(t.id),
                            name: t.description,
                            category: (t.scope as unknown as TaskScope)?.category ?? 'Desconocida',
                            authority: (t.scope as unknown as TaskScope)?.source ?? 'Desconocida',
                            dueDate: new Date(((t.scope as unknown as TaskScope)?.due_date ?? '1970-01-01') + 'T00:00:00').toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            }),
                            status: t.overallStatus === 'Atrasada' ? 'Vencido' : 'Pendiente',
                            rawDueISO: (t.scope as unknown as TaskScope)?.due_date,
                        })
                    );
                setPendingObligations(criticalObligations);
            } catch (error: any) {
                let displayMessage = 'Ocurrió un error inesperado al cargar los datos del dashboard.';
                if (error && typeof error === 'object' && 'message' in error) {
                    const dbError = error as { code?: string; message?: string };
                    console.error('Error fetching dashboard data:', dbError.message, dbError);
                    displayMessage = `Error al cargar datos: ${dbError.message}`;
                } else if (error instanceof Error) {
                    displayMessage = `Error al cargar datos: ${error.message}`;
                }
                setFetchError(displayMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [profile]);

    // Cleanup timers on unmount
    useEffect(() => () => {
        removalTimers.current.forEach(id => clearTimeout(id));
        removalTimers.current.clear();
    }, []);

    const handleCompleted = (item: ComplianceObligation, wasStatus: ComplianceObligation['status'], undoFn?: () => Promise<void> | void) => {
        // KPI adjust immediately
        setKpis(prev => {
            const clone = [...prev];
            const find = (title: string) => clone.find(k => k.title === title);
            const total = parseInt(find('Total de Tareas')?.value || '0', 10);
            const pendObj = find('Tareas Pendientes');
            const overObj = find('Tareas Atrasadas');
            if (wasStatus === 'Pendiente' && pendObj) pendObj.value = Math.max(0, parseInt(pendObj.value, 10) - 1).toString();
            if (wasStatus === 'Vencido' && overObj) overObj.value = Math.max(0, parseInt(overObj.value, 10) - 1).toString();
            const completed = total - (parseInt(find('Tareas Pendientes')?.value || '0', 10) + parseInt(find('Tareas Atrasadas')?.value || '0', 10));
            const compObj = find('Cumplimiento General');
            if (compObj) compObj.value = total > 0 ? `${Math.round((completed / total) * 100)}%` : '100%';
            return clone;
        });
        // Schedule removal after grace period (10s)
        if (!removalTimers.current.has(item.id)) {
            const t = setTimeout(() => {
                setPendingObligations(prev => prev.filter(o => o.id !== item.id));
                removalTimers.current.delete(item.id);
            recentlyCompleted.current.delete(item.id);
            }, 10000);
            removalTimers.current.set(item.id, t);
        }
        recentlyCompleted.current.add(item.id);
        // Provide toast with undo
        if (undoFn) {
            toast.addToast('success', 'Obligación marcada como cumplida.', 8000, {
                label: 'Deshacer',
                onClick: async () => {
                    clearTimeout(removalTimers.current.get(item.id));
                    removalTimers.current.delete(item.id);
                    await undoFn();
                    // Restore KPIs
                    setKpis(prev => {
                        const clone = [...prev];
                        const find = (title: string) => clone.find(k => k.title === title);
                        const total = parseInt(find('Total de Tareas')?.value || '0', 10);
                        const pendObj = find('Tareas Pendientes');
                        const overObj = find('Tareas Atrasadas');
                        if (wasStatus === 'Pendiente' && pendObj) pendObj.value = (parseInt(pendObj.value, 10) + 1).toString();
                        if (wasStatus === 'Vencido' && overObj) overObj.value = (parseInt(overObj.value, 10) + 1).toString();
                        const completed = total - (parseInt(find('Tareas Pendientes')?.value || '0', 10) + parseInt(find('Tareas Atrasadas')?.value || '0', 10));
                        const compObj = find('Cumplimiento General');
                        if (compObj) compObj.value = total > 0 ? `${Math.round((completed / total) * 100)}%` : '100%';
                        return clone;
                    });
                },
            });
        } else {
            toast.addToast('success', 'Obligación marcada como cumplida.', 5000);
        }
    };

    // Reset page when filter or query changes
    useEffect(() => { setPage(0); }, [obligationFilter, query]);
    const filteredObligations = pendingObligations.filter(item => {
        if (!(obligationFilter === 'Todas' || item.status === obligationFilter)) return false;
        if (!query) return true;
        const q = query.toLowerCase();
        return [item.name, item.category, item.authority].some(f => (f || '').toLowerCase().includes(q));
    });
    const totalPages = Math.ceil(filteredObligations.length / pageSize) || 1;
    const pageItems = filteredObligations.slice(page * pageSize, page * pageSize + pageSize);

    

    return (
        <div className="p-4 md:p-8">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-medium text-gradient mb-1">Dashboard de Cumplimiento</h2>
                    <p className="text-slate-300 text-sm">Resumen del estado de cumplimiento de la institución.</p>
                </div>
                <div className="hidden md:flex gap-2">
                    <button
                        onClick={() => {
                            const kw = query || (obligationFilter !== 'Todas' ? obligationFilter : '');
                            setTareasInitialKeyword?.(kw || null);
                            setActiveView('tareas');
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white hover:opacity-95 transition-colors"
                        style={{ background: 'linear-gradient(135deg, #22c55e, #3b82f6)' }}
                    >
                        Ver Tareas
                    </button>
                    <button
                        onClick={() => setActiveView('gantt')}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white hover:opacity-95 transition-colors"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
                    >
                        Gráfica de Gantt
                    </button>
                    <button
                        onClick={() => setActiveView('reportes')}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white hover:opacity-95 transition-colors"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
                    >
                        Generar Reporte
                    </button>
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            ) : fetchError ? (
                <div className="p-8 m-4 bg-rose-500/10 border border-rose-400/20 rounded-lg text-center animate-fade-in">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-400/20">
                        <ExclamationTriangleIcon className="h-6 w-6 text-rose-300" />
                    </div>
                    <h3 className="mt-4 text-base font-medium text-rose-200">Error al Cargar Datos</h3>
                    <p className="mt-2 text-sm text-rose-200/80 whitespace-pre-wrap">{fetchError}</p>
                </div>
            ) : (
                <>
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                <main className="col-span-12 lg:col-span-8">
                                                <div className="glass p-3 md:p-4 rounded-xl border border-white/12 sticky top-6 z-20 mb-4 backdrop-blur-sm">
                                                    <SearchBar query={query} setQuery={setQuery} onOpenFilters={() => setFiltersOpen(true)} />
                                                </div>
                                                <div className="glass p-6 rounded-xl shadow-md border border-white/12 bg-gradient-to-b from-black/30 to-transparent">
                                                    <div className="flex items-center justify-between gap-4 mb-4">
                                                        <h3 className="text-base font-medium text-slate-100">Obligaciones Críticas Próximas</h3>
                                                    </div>
                                                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                                        {pageItems.length > 0 ? (
                                                            pageItems
                                                                .filter(item => {
                                                                    if (!query) return true;
                                                                    const q = query.toLowerCase();
                                                                    return [item.name, item.category, item.authority].some(f => (f || '').toLowerCase().includes(q));
                                                                })
                                                                .map(item => (
                                                                    <ComplianceItemCard
                                                                        key={item.id}
                                                                        item={item}
                                                                        recentlyCompleted={recentlyCompleted.current.has(item.id)}
                                                                        onCompleted={(wasStatus, undoFn) => handleCompleted(item, wasStatus, undoFn)}
                                                                    />
                                                                ))
                                                        ) : (
                                                            <p className="text-slate-300 text-center p-4">¡Felicidades! No hay obligaciones críticas pendientes.</p>
                                                        )}
                                                    </div>
                                                    {filteredObligations.length > pageSize && (
                                                        <div className="flex items-center justify-between mt-4 text-xs text-slate-300 gap-4 flex-wrap">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                                                    disabled={page === 0}
                                                                    className={`px-3 py-1 rounded-md font-medium border border-white/10 transition-colors ${page === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10'}`}
                                                                >Anterior</button>
                                                                <span className="px-2">Página {page + 1} de {totalPages}</span>
                                                                <button
                                                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                                                    disabled={page + 1 >= totalPages}
                                                                    className={`px-3 py-1 rounded-md font-medium border border-white/10 transition-colors ${(page + 1 >= totalPages) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10'}`}
                                                                >Siguiente</button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {Array.from({ length: totalPages }, (_, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => setPage(i)}
                                                                        className={`w-7 h-7 rounded-md text-[11px] font-semibold border border-white/10 ${i === page ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white' : 'text-slate-300 hover:bg-white/10'}`}
                                                                        aria-label={`Ir a la página ${i+1}`}
                                                                    >{i + 1}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="text-right mt-4">
                                                        <button
                                                            onClick={() => {
                                                                const kw = query || (obligationFilter !== 'Todas' ? obligationFilter : '');
                                                                setTareasInitialKeyword?.(kw || null);
                                                                setActiveView('tareas');
                                                            }}
                                                            className="text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                                                            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)' }}
                                                        >
                                                            Ir a tareas →
                                                        </button>
                                                    </div>
                                                </div>
                                            </main>
                                            <aside className="col-span-12 lg:col-span-4">
                                                <div className="space-y-6">
                                                    <div className="glass p-4 rounded-xl border border-white/10">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {kpis.map((kpi, index) => (
                                                                <KpiCard key={kpi.title} kpi={kpi} icon={icons[index % icons.length]} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <ReminderList className="glass p-4 rounded-xl border border-white/10" />
                                                </div>
                                            </aside>
                                        </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;