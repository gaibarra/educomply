








import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Task, SubTask, TaskOverallStatus, Profile, Database, TaskScope } from '../types';
import SubTaskItem from './SubTaskItem';
import PlusCircleIcon from './icons/PlusCircleIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import DownloadIcon from './icons/DownloadIcon';
import SubTaskSuggestionModal from './SubTaskSuggestionModal';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';

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
    
    const handleDownloadDocument = async (docName: string) => {
        const buildAndDownload = (json: any) => {
            const md = `# ${json.title}\n\n${json.summary}\n\n${json.body_markdown}\n\n---\nSources:\n${(json.sources||[]).map((s:any)=>`- ${s.citation}${s.url?` (${s.url})`:''}`).join('\n')}\n\n> ${json.disclaimer}`;
            const blob = new Blob([md], { type: 'text/markdown' });
            const dlName = (json.filename || docName.replace(/[\s/]/g,'_') + '.md');
            const urlObj = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlObj;
            a.download = dlName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(urlObj);
        };
        const payload = {
            docName,
            taskDescription: task.description,
            category: (task.scope as TaskScope)?.category || 'General',
            source: (task.scope as TaskScope)?.source || '',
            language: 'es'
        };
        try {
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
                    body: JSON.stringify(payload)
                });
                text = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0,120)}`);
                const json = JSON.parse(text);
                buildAndDownload(json);
                return;
            } catch (primaryErr) {
                console.warn('[generate-document] fetch directo falló, intento invoke()', primaryErr);
            }
            // Fallback a invoke estándar (maneja CORS internamente)
            const { data, error } = await (supabase as any).functions.invoke('generate-document', { body: payload });
            if (error) throw error;
            buildAndDownload(data);
        } catch (e:any) {
            console.error('Fallo generando documento', e);
            alert('No se pudo generar el documento.');
        }
    };

    const progress = task.subTasks.length > 0 
        ? (task.subTasks.filter(st => st.status === 'Completada').length / task.subTasks.length) * 100 
        : 0;
    const status = getTaskStatus(task);
    
    const statusClasses: Record<TaskOverallStatus, string> = {
        'Atrasada': 'bg-red-100 text-red-800',
        'Completada': 'bg-green-100 text-green-800',
        'En Progreso': 'bg-blue-100 text-blue-800',
        'Pendiente': 'bg-yellow-100 text-yellow-800',
    };
    
    const taskCategory = (task.scope as TaskScope)?.category ?? 'General';
    const dueDateString = task.scope?.due_date;

    return (
        <>
        <div className="bg-white rounded-xl shadow-lg transition-all duration-300">
            <div className="p-5 border-b border-slate-200 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                         <div className="flex items-center gap-3 flex-wrap">
                            <span className="bg-brand-secondary/10 text-brand-secondary text-xs font-bold px-2 py-1 rounded-full">{taskCategory}</span>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusClasses[status]}`}>
                                {status}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mt-2">{task.description}</h3>
                         <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500 mt-1">
                            <span>Fuente: {task.scope?.source ?? 'No especificada'}</span>
                            {task.scope && task.scope.level !== 'Institución' && (
                                <div className="flex items-center gap-1.5 text-brand-primary font-medium bg-brand-secondary/10 px-2 py-0.5 rounded-full">
                                    <BuildingOfficeIcon className="w-4 h-4"/>
                                    <span>{task.scope.level}: {task.scope.entity}</span>
                                </div>
                            )}
                        </div>
                    </div>
                     <button className="text-slate-400 hover:text-brand-primary p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-600">Responsable Principal:</p>
                        <p className="text-slate-800 font-medium">{task.responsible_person?.full_name || 'No asignado'}</p>
                    </div>
                     <div>
                        <p className="text-sm font-semibold text-slate-600 text-right">Fecha Límite:</p>
                        <p className={`font-bold ${status === 'Atrasada' ? 'text-status-danger' : 'text-slate-800'}`}>
                           {dueDateString ? new Date(dueDateString + 'T00:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No definida'}
                        </p>
                    </div>
                </div>
                 <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-600">Progreso</span>
                        <span className="text-sm font-bold text-brand-secondary">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-status-success' : 'bg-brand-secondary'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-5 animate-fade-in space-y-5">
                    {task.documents && task.documents.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2.5">
                                <DocumentTextIcon className="w-6 h-6 text-brand-secondary"/>
                                Documentos Sugeridos
                            </h4>
                            <ul className="space-y-2 pl-2">
                                {task.documents.map(doc => (
                                    <li key={doc} className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-md border border-slate-200/80">
                                        <div className="flex items-center gap-3">
                                            <DocumentTextIcon className="w-5 h-5 text-slate-500 shrink-0"/>
                                            <span className="text-sm text-slate-700">{doc}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDownloadDocument(doc)}
                                            className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200 hover:text-brand-secondary transition-colors"
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
                        <h4 className="text-lg font-semibold text-slate-700 mb-3">Plan de Acción y Sub-tareas</h4>
                        <div className="flex flex-col">
                            {task.subTasks.map((subtask, index) => (
                                <SubTaskItem 
                                    key={subtask.id} 
                                    subTask={subtask} 
                                    onUpdate={handleUpdateSubTask}
                                    onDelete={handleDeleteSubTask}
                                    availableTeamMembers={availableTeamMembers}
                                    isLastItem={index === task.subTasks.length - 1}
                                    currentUserProfile={currentUserProfile}
                                />
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/80">
                            <button 
                                onClick={handleAddSubTask}
                                className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors"
                            >
                                <PlusCircleIcon className="w-5 h-5"/>
                                Agregar Sub-tarea
                            </button>
                        </div>
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
        </>
    );
};

export default TaskCard;