








import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Task, SubTask, TaskOverallStatus, Profile, Database, TaskScope } from '../types';
import SubtaskList from './SubtaskList';
import DocumentPreviewModal from './DocumentPreviewModal';
import DocumentTextIcon from './icons/DocumentTextIcon';
import DownloadIcon from './icons/DownloadIcon';
import SubTaskSuggestionModal from './SubTaskSuggestionModal';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import { useToast } from './ToastProvider';
import SuspendTaskModal from './SuspendTaskModal';

interface TaskCardProps {
    task: Task;
    onUpdateTask: (updatedTask: Task) => void;
    availableTeamMembers: Profile[];
    currentUserProfile: Profile;
}

const getTaskStatus = (task: Task): TaskOverallStatus => {
    const dueDateStr = task.scope?.due_date;

    if (!task.subTasks || task.subTasks.length === 0) {
        if (!dueDateStr) return 'Pendiente';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        return dueDate < today ? 'Atrasada' : 'Pendiente';
    }

    const completedSubTasks = task.subTasks.filter(st => st.status === 'Completada').length;
    const progress = (completedSubTasks / task.subTasks.length) * 100;
    
    if (progress === 100) {
        return 'Completada';
    }
    
    if (dueDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        if (dueDate < today) {
            return 'Atrasada';
        }
    }

    if (progress > 0) {
        return 'En Progreso';
    }
    return 'Pendiente';
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdateTask, availableTeamMembers, currentUserProfile }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
    const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
    const toast = useToast();

    const handleAddSubTask = () => {
        if (task.subTasks.length === 0) {
            setIsSuggestionModalOpen(true);
        } else {
             handleCreateSubTasksFromSuggestions([]); // Trigger manual creation
        }
    };
    
    const handleCreateSubTasksFromSuggestions = async (suggestedDescriptions: string[]) => {
        setIsSuggestionModalOpen(false);
        
        const descriptions = suggestedDescriptions.length > 0 
            ? suggestedDescriptions 
            : ['']; // For manual creation

        const newSubTasksToInsert: Array<Database['public']['Tables']['sub_tasks']['Insert']> = descriptions.map(desc => ({
            task_id: task.id,
            description: desc,
            status: 'Pendiente' as const,
        }));
        
        const { data: insertedSubTasks, error } = await supabase
            .from('sub_tasks')
            .insert(newSubTasksToInsert as any)
            .select('id, created_at, description, status, task_id, assigned_to_id');

        if (error) {
            console.error("Error creating subtasks:", error);
            alert(`Error: ${error.message}`);
            return;
        }

        if (insertedSubTasks) {
            const enrichedSubTasks = (insertedSubTasks as any[]).map(st => ({
                ...st,
                assigned_to: null,
                comments: [],
                documents: [],
            }));
            const updatedTask = { 
                ...task, 
                subTasks: [...task.subTasks, ...(enrichedSubTasks as unknown as SubTask[])]
            };
            onUpdateTask(updatedTask);
        }
    };


    const handleUpdateSubTask = (updatedSubTask: SubTask) => {
        const updatedSubTasks = task.subTasks.map(st => st.id === updatedSubTask.id ? updatedSubTask : st);
        const updatedTask = { ...task, subTasks: updatedSubTasks };
        onUpdateTask(updatedTask);
    };

    const handleDeleteSubTask = async (subTaskId: string) => {
        if (confirm('¿Está seguro de que desea eliminar esta sub-tarea?')) {
            const { error } = await supabase.from('sub_tasks').delete().eq('id', subTaskId);
            if (error) {
                 console.error("Error deleting subtask:", error);
                 alert(`Error: ${error.message}`);
                 return;
            }
            const updatedSubTasks = task.subTasks.filter(st => st.id !== subTaskId);
            const updatedTask = { ...task, subTasks: updatedSubTasks };
            onUpdateTask(updatedTask);
        }
    };
    
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const handleDownloadDocument = async (docName: string) => {
        const buildAndOpenPreview = (json: any) => {
            setPreviewDoc({ ...json });
            setPreviewOpen(true);
        };
        const payload = {
            docName,
            taskDescription: task.description,
            category: (task.scope as TaskScope)?.category || 'General',
            source: (task.scope as TaskScope)?.source || '',
            language: 'es'
        };
        let processingToastId: string | null = null;
        const controller = new AbortController();
        try {
            // show persistent processing toast with Cancel action
            processingToastId = toast.addToast('processing', 'Procesando Compliance del Documento.....', 0, {
                label: 'Cancelar',
                onClick: () => {
                    try { controller.abort(); } catch { /* ignore */ }
                    if (processingToastId) toast.removeToast(processingToastId);
                }
            });
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            const anonKey = (supabase as any).anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
            const supaUrl = (supabase as any).supabaseUrl || '';
            const url = `${supaUrl.replace(/\/$/,'')}/functions/v1/generate-document`;
            let res: Response | null = null;
            let text = '';
            try {
                res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': anonKey,
                        'Authorization': `Bearer ${token || anonKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                text = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0,120)}`);
                const json = JSON.parse(text);
                buildAndOpenPreview(json);
                // remove processing toast on success after brief delay for smoothness
                if (processingToastId) setTimeout(() => toast.removeToast(processingToastId!), 800);
                return;
            } catch (primaryErr) {
                console.warn('[generate-document] fetch directo falló, intento invoke()', primaryErr);
            }
            // Fallback a invoke estándar (maneja CORS internamente)
            // supabase functions.invoke has no AbortController signal; create abortable promise
            const invokePromise = (supabase as any).functions.invoke('generate-document', { body: payload });
            const abortPromise = new Promise((_, rej) => {
                controller.signal.addEventListener('abort', () => rej(new Error('aborted')));
            });
            const { data, error } = await Promise.race([invokePromise, abortPromise]) as any;
            if (error) throw error;
            buildAndOpenPreview(data);
            // remove processing toast on success after brief delay for smoothness
            if (processingToastId) setTimeout(() => toast.removeToast(processingToastId!), 800);
        } catch (e:any) {
            console.error('Fallo generando documento', e);
            if (processingToastId) toast.removeToast(processingToastId);
            if (e?.message === 'aborted') {
                toast.addToast('info', 'Generación cancelada', 3000);
            } else {
                toast.addToast('error', 'Error generando documento', 6000);
                alert('No se pudo generar el documento.');
            }
        }
    };

    const doDownloadFromPreview = (json: any) => {
        if (!json) return;
        const md = `# ${json.title}\n\n${json.summary}\n\n${json.body_markdown}\n\n---\nSources:\n${(json.sources||[]).map((s:any)=>`- ${s.citation}${s.url?` (${s.url})`:''}`).join('\n')}\n\n> ${json.disclaimer}`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const dlName = (json.filename || 'document.md');
        const urlObj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = dlName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(urlObj);
        setPreviewOpen(false);
        setPreviewDoc(null);
    };

    const progress = task.subTasks.length > 0 
        ? (task.subTasks.filter(st => st.status === 'Completada').length / task.subTasks.length) * 100 
        : 0;
    const status = getTaskStatus(task);
    
    const statusClasses: Record<TaskOverallStatus, string> = {
        'Atrasada': 'state-gradient-error text-white shadow-sm',
        'Completada': 'state-gradient-task text-white shadow-sm',
        'En Progreso': 'state-gradient-subtask text-white shadow-sm',
        'Pendiente': 'bg-yellow-400/90 text-slate-900 shadow-sm',
    };
    
    const taskCategory = (task.scope as TaskScope)?.category ?? 'General';
    const dueDateString = task.scope?.due_date;

    return (
        <>
        <div className="glass rounded-xl shadow-xl transition-all duration-300 hover-3d font-sans">
            <div className="p-5 border-b border-white/10 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                         <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-bold px-2 py-1 rounded-full text-white state-gradient-project">{taskCategory}</span>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusClasses[status]}`}>
                                {status}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-100 mt-2">{task.description}</h3>
                         <div className="flex items-center gap-4 flex-wrap text-sm text-slate-300 mt-1">
                            <span>Fuente: {task.scope?.source ?? 'No especificada'}</span>
                            {task.scope && task.scope.level !== 'Institución' && (
                                <div className="flex items-center gap-1.5 text-white font-medium state-gradient-subtask px-2 py-0.5 rounded-full">
                                    <BuildingOfficeIcon className="w-4 h-4"/>
                                    <span>{task.scope.level}: {task.scope.entity}</span>
                                </div>
                            )}
                        </div>
                    </div>
                     <button className="text-slate-300 hover:text-primary p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mt-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-300">Responsable Principal</p>
                            <p className="text-slate-100 font-medium">{task.responsible_person?.full_name || 'No asignado'}</p>
                        </div>
                        {status === 'Completada' && (task.completed_by || task.completed_at) && (
                            <div>
                                <p className="text-sm font-semibold text-emerald-300 flex items-center gap-1">Marcada como cumplida</p>
                                <p className="text-emerald-200 text-sm">
                                    {task.completed_by_profile?.full_name || 'Usuario desconocido'}{task.completed_at ? ' · ' + new Date(task.completed_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-slate-300">Fecha Límite</p>
                        <p className={`font-bold ${status === 'Atrasada' ? 'text-status-danger' : 'text-slate-100'}`}>
                            {dueDateString ? new Date(dueDateString + 'T00:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No definida'}
                        </p>
                    </div>
                </div>
                {currentUserProfile.role === 'admin' && (
                    <div className="p-4 border-t border-white/6 flex items-center justify-end gap-3">
                        {!task.suspended ? (
                            <button onClick={() => setIsSuspendModalOpen(true)} className="px-3 py-1 rounded-md bg-amber-400 text-white font-semibold">Suspender</button>
                        ) : (
                            <span className="px-3 py-1 rounded-md bg-emerald-700 text-white font-semibold">Suspendida</span>
                        )}
                    </div>
                )}
                 <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-300">Progreso</span>
                        <span className="text-sm font-bold text-slate-100">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-status-success' : 'state-gradient-subtask'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-5 animate-fade-in space-y-5">
                    {/* Quick completion panel for tasks without subtasks */}
                    {task.subTasks.length === 0 && (
                        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 flex flex-col gap-3">
                            <p className="text-sm text-emerald-200">Esta tarea no tiene sub-tareas. Puedes marcarla directamente como cumplida o agregar un plan de acción.</p>
                            <div className="flex flex-wrap gap-3">
                                {status !== 'Completada' && (
                                    <button
                                        onClick={async ()=> {
                                            try {
                                                // Intentar RPC (creará sub_tarea genérica si no existen)
                                                const { error } = await supabase.rpc('mark_task_completed', { p_task_id: task.id });
                                                if (error) throw error;
                                            } catch (e:any) {
                                                // Fallback: crear sub_tarea manualmente
                                                try {
                                                    await supabase.from('sub_tasks').insert({ task_id: task.id, title: 'Marcado como cumplido', status: 'Completada' } as any);
                                                } catch (fbErr:any) {
                                                    toast.addToast('error', 'No se pudo marcar como cumplida: ' + (fbErr?.message||'Error'), 6000);
                                                    return;
                                                }
                                            }
                                            // Refrescar subtareas locales
                                            const { data: freshSubs } = await supabase.from('sub_tasks').select('*').eq('task_id', task.id);
                                            const enriched = (freshSubs||[]).map(st => ({ ...st, comments: [], documents: [], assigned_to: null })) as unknown as SubTask[];
                                            onUpdateTask({ ...task, subTasks: enriched });
                                            toast.addToast('success', 'Tarea marcada como cumplida', 4000, { label: 'Reabrir', onClick: async () => {
                                                try { await supabase.rpc('reopen_task', { p_task_id: task.id }); } catch { await supabase.from('sub_tasks').update({ status: 'Pendiente' }).eq('task_id', task.id); }
                                                const { data: subs2 } = await supabase.from('sub_tasks').select('*').eq('task_id', task.id);
                                                const enriched2 = (subs2||[]).map(st => ({ ...st, comments: [], documents: [], assigned_to: null })) as unknown as SubTask[];
                                                onUpdateTask({ ...task, subTasks: enriched2 });
                                                toast.addToast('info', 'Tarea reabierta', 4000);
                                            }});
                                            try { window.dispatchEvent(new CustomEvent('task-status-changed', { detail: { taskId: task.id, newStatus: 'Completada' }})); } catch { /* ignore */ }
                                        }}
                                        className="px-4 py-2 rounded-md text-sm font-semibold text-white shadow-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 transition"
                                    >Marcar tarea como cumplida</button>
                                )}
                                {status === 'Completada' && (
                                    <button
                                        onClick={async ()=> {
                                            try { await supabase.rpc('reopen_task', { p_task_id: task.id }); } catch { await supabase.from('sub_tasks').update({ status: 'Pendiente' }).eq('task_id', task.id); }
                                            const { data: subs2 } = await supabase.from('sub_tasks').select('*').eq('task_id', task.id);
                                            const enriched2 = (subs2||[]).map(st => ({ ...st, comments: [], documents: [], assigned_to: null })) as unknown as SubTask[];
                                            onUpdateTask({ ...task, subTasks: enriched2 });
                                            toast.addToast('info', 'Tarea reabierta', 4000);
                                            try { window.dispatchEvent(new CustomEvent('task-status-changed', { detail: { taskId: task.id, newStatus: 'Reabierta' }})); } catch { /* ignore */ }
                                        }}
                                        className="px-4 py-2 rounded-md text-sm font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 transition"
                                    >Reabrir tarea</button>
                                )}
                                <button
                                    onClick={handleAddSubTask}
                                    className="px-4 py-2 rounded-md text-sm font-semibold text-slate-100 bg-white/10 border border-white/20 hover:bg-white/20 transition"
                                >Agregar sub-tareas</button>
                            </div>
                        </div>
                    )}
                    {task.documents && task.documents.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2.5">
                                <DocumentTextIcon className="w-6 h-6 text-slate-200"/>
                                Documentos Sugeridos
                            </h4>
                            <ul className="space-y-2 pl-2">
                                {task.documents.map(doc => (
                                    <li key={doc} className="flex items-center justify-between gap-3 p-2 bg-white/5 rounded-md border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <DocumentTextIcon className="w-5 h-5 text-slate-300 shrink-0"/>
                                            <span className="text-sm text-slate-100">{doc}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDownloadDocument(doc)}
                                            className="p-1.5 rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                                            aria-label={`Descargar ${doc}`}
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <div>
                        <SubtaskList
                            subtasks={task.subTasks}
                            onUpdateSubtask={handleUpdateSubTask}
                            onDeleteSubtask={handleDeleteSubTask}
                            onAdd={handleAddSubTask}
                            availableTeamMembers={availableTeamMembers}
                            currentUserProfile={currentUserProfile}
                        />
                    </div>
                </div>
            )}
        </div>
        {isSuggestionModalOpen && (
            <SubTaskSuggestionModal
                isOpen={isSuggestionModalOpen}
                onClose={() => setIsSuggestionModalOpen(false)}
                onSubmit={handleCreateSubTasksFromSuggestions}
                taskDescription={task.description}
                taskCategory={taskCategory}
            />
        )}
        {isSuspendModalOpen && (
            <SuspendTaskModal isOpen={isSuspendModalOpen} onClose={() => setIsSuspendModalOpen(false)} task={task} onSuspend={(updated) => { onUpdateTask(updated); setIsSuspendModalOpen(false); }} />
        )}
        <DocumentPreviewModal open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewDoc(null); }} doc={previewDoc} onDownload={doDownloadFromPreview} />
        </>
    );
};

export default TaskCard;