

import React, { useState, useEffect } from 'react';
import KpiCard from './KpiCard';
import ComplianceItemCard from './ComplianceItemCard';
import type { Kpi, ComplianceObligation, Profile, View, TaskOverallStatus, TaskScope, TaskFromDb } from '../types';
import { supabase } from '../services/supabaseClient';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

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
    
    // Simplificado para el dashboard: si no hay subtareas, se usa la fecha
    if (task.subTasks && task.subTasks.length > 0) {
        const allCompleted = task.subTasks.every(st => st.status === 'Completada');
        if (allCompleted) return 'Completada';
        
        if (dueDateStr) {
            const dueDate = new Date(dueDateStr + 'T00:00:00');
            if (dueDate < today) return 'Atrasada';
        }
        
        const someProgress = task.subTasks.some(st => st.status !== 'Pendiente');
        if (someProgress) return 'En Progreso';
    } else {
        if (dueDateStr) {
            const dueDate = new Date(dueDateStr + 'T00:00:00');
            if (dueDate < today) return 'Atrasada';
        }
    }
    return 'Pendiente';
};


const Dashboard: React.FC<{ profile: Profile; setActiveView: (view: View) => void }> = ({ profile, setActiveView }) => {
    const [kpis, setKpis] = useState<Kpi[]>([]);
    const [pendingObligations, setPendingObligations] = useState<ComplianceObligation[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setFetchError(null);
            try {
                // With RLS policies implemented on the backend, we no longer need client-side role filtering.
                // The database now securely handles which tasks are visible to the current user.

                // Step 1: Fetch all tasks accessible to the user.
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('id, description, scope')
                    .order('scope->>due_date' as any, { ascending: true });

                if (tasksError) throw tasksError;

                const typedTasksData = tasksData as unknown as (Pick<TaskFromDb, 'id' | 'description' | 'scope'>[] | null);
                
                const taskIds = (typedTasksData || []).map((t) => t.id);

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

                // Step 2: Fetch sub-tasks for the retrieved tasks.
                const { data: subTasksData, error: subTasksError } = await supabase
                    .from('sub_tasks')
                    .select('task_id, status')
                    .in('task_id', taskIds);
                
                if (subTasksError) throw subTasksError;

                const typedSubTasksData = subTasksData as unknown as ({ task_id: string, status: string }[] | null);

                // Step 3: Map sub-tasks back to their parent tasks
                const subTasksByTaskId = (typedSubTasksData || []).reduce((acc: Record<string, { status: string }[]>, st) => {
                    acc[st.task_id] = acc[st.task_id] || [];
                    acc[st.task_id].push(st);
                    return acc;
                }, {});

                const combinedTasks = (typedTasksData || []).map((t) => ({
                    ...t,
                    subTasks: subTasksByTaskId[t.id] || [],
                }));

                // Calcular KPIs
                const totalTasks = combinedTasks.length;
                const tasksWithStatus = combinedTasks.map(t => ({...t, overallStatus: getTaskStatus(t)}));
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
                
                // Obtener obligaciones críticas
                const criticalObligations = tasksWithStatus
                    .filter(t => t.overallStatus === 'Pendiente' || t.overallStatus === 'Atrasada')
                    .slice(0, 3)
                    .map((t): ComplianceObligation => ({
                        id: String(t.id),
                        name: t.description,
                        category: (t.scope as unknown as TaskScope)?.category ?? 'Desconocida',
                        authority: (t.scope as unknown as TaskScope)?.source ?? 'Desconocida',
                        dueDate: new Date(((t.scope as unknown as TaskScope)?.due_date ?? '1970-01-01') + 'T00:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                        status: t.overallStatus === 'Atrasada' ? 'Vencido' : 'Pendiente'
                    }));
                setPendingObligations(criticalObligations);
                
            } catch (error: any) {
                let displayMessage = 'Ocurrió un error inesperado al cargar los datos del dashboard.';
                if (error && typeof error === 'object' && 'message' in error) {
                    const dbError = error as { code?: string; message?: string; hint?: string };
                    console.error("Error fetching dashboard data:", dbError.message, dbError);
                    if (dbError.code === '42P17' || (dbError.message && String(dbError.message).includes('infinite recursion'))) {
                        displayMessage = "Error de Configuración (Recursión Infinita):\nNo se pudieron cargar las tareas debido a un problema de seguridad en la base de datos (RLS). Por favor, contacte a un administrador para que revise las políticas de las tablas 'tasks' y 'sub_tasks'.";
                    } else if (dbError.message.includes('permission denied for function')) {
                        const functionNameMatch = dbError.message.match(/permission denied for function ([\w_]+)/);
                        const functionName = functionNameMatch ? functionNameMatch[1] : 'desconocida';
                        if (profile.role === 'admin') {
                            displayMessage = `Error de Permisos de Administrador:\n\nAunque ha iniciado sesión como administrador, el rol 'admin' de la base de datos no tiene permiso para ejecutar la función \`${functionName}\`. Esto es un problema de configuración en la base de datos.\n\nAcción Sugerida para el Administrador de Base de Datos:\nEjecutar el comando SQL: \`GRANT EXECUTE ON FUNCTION ${functionName} TO authenticated;\``;
                        } else {
                            displayMessage = `Error de Permisos:\nSu rol de usuario no tiene permiso para acceder a los datos del dashboard porque el acceso a la función de base de datos \`${functionName}\` fue denegado. Por favor, contacte a un administrador.`;
                        }
                    } else {
                        displayMessage = `Error al cargar datos: ${dbError.message}`;
                    }
                } else if (error instanceof Error) {
                    console.error("Error fetching dashboard data:", error);
                    displayMessage = `Error al cargar datos: ${error.message}`;
                } else {
                    console.error("Unknown error fetching dashboard data:", error);
                }
                setFetchError(displayMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile]);
    
  return (
    <div className="p-6 md:p-8 bg-slate-100">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Dashboard de Cumplimiento</h2>
      <p className="text-slate-500 mb-8">Resumen del estado de cumplimiento de la institución.</p>
      
      {loading ? (
        <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      ) : fetchError ? (
         <div className="p-8 m-4 bg-red-50 border border-red-200 rounded-lg text-center animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <ExclamationTriangleIcon className="h-6 w-6 text-status-danger" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-red-800">Error al Cargar Datos</h3>
            <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                {fetchError}
            </p>
        </div>
      ) : (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpis.map((kpi, index) => (
            <KpiCard key={kpi.title} kpi={kpi} icon={icons[index % icons.length]} />
            ))}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Obligaciones Críticas Próximas</h3>
            <div className="space-y-4">
            {pendingObligations.length > 0 ? pendingObligations.map(item => (
                <ComplianceItemCard key={item.id} item={item} />
            )) : <p className="text-slate-500 text-center p-4">¡Felicidades! No hay obligaciones críticas pendientes.</p>}
            </div>
            <div className="text-right mt-4">
                <button onClick={() => setActiveView('tareas')} className="text-brand-secondary font-semibold hover:text-brand-primary transition-colors">
                    Ver todas las tareas →
                </button>
            </div>
        </div>
      </>
      )}
    </div>
  );
};

export default Dashboard;