



import React, { useState, useEffect } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { Task, ResponsibleArea, Profile, TaskFromDb, TaskScope } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import TrashIcon from './icons/TrashIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';

interface TasksReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tasks: Omit<TaskFromDb, 'id'|'created_at'|'owner_id'|'project_id'>[]) => void;
    initialTasks: Omit<Task, 'id'|'created_at'|'subTasks'|'responsible_area'|'responsible_person'>[];
    availableAreas: ResponsibleArea[];
    availablePersons: Profile[];
}

type EditableTask = Omit<Task, 'id'|'created_at'|'subTasks'|'responsible_area'|'responsible_person'> & { tempId: string };

const TasksReviewModal: React.FC<TasksReviewModalProps> = ({ isOpen, onClose, onSave, initialTasks, availableAreas, availablePersons }) => {
    const [editedTasks, setEditedTasks] = useState<EditableTask[]>([]);

    useEffect(() => {
        setEditedTasks(initialTasks.map((task, index) => ({
            ...task,
            tempId: `task-${Date.now()}-${index}`
        })));
    }, [initialTasks, isOpen]);

    if (!isOpen) return null;

    const handleTaskChange = (tempId: string, field: keyof EditableTask, value: any) => {
        setEditedTasks(prevTasks =>
            prevTasks.map(task =>
                task.tempId === tempId ? { ...task, [field]: value } : task
            )
        );
    };

    const handleRemoveTask = (tempId: string) => {
        setEditedTasks(prevTasks => prevTasks.filter(task => task.tempId !== tempId));
    };

    const handleSave = () => {
    // Remove tempId and other non-db fields before saving
    const finalTasks: Omit<TaskFromDb, 'id'|'created_at'|'owner_id'|'project_id'>[] = editedTasks.map(t => ({
            description: t.description,
            documents: t.documents,
            responsible_area_id: t.responsible_area_id!,
            responsible_person_id: t.responsible_person_id!,
            scope: t.scope,
        }));
        onSave(finalTasks);
    };
    
    const inputBaseStyles = "w-full p-2 bg-white border border-slate-300 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-colors duration-200";
    // selectArrowStyle removed (EnhancedSelect)


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="bg-slate-50 text-slate-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-brand-primary">Revisión Final de Tareas</h2>
                    <p className="text-sm text-slate-500 mt-1">Verifique y edite los detalles antes de crear las tareas definitivas.</p>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 space-y-5 bg-slate-100">
                     {editedTasks.map(task => (
                        <div key={task.tempId} className="bg-white p-5 rounded-lg shadow-md border border-slate-200 flex flex-col md:flex-row gap-6 relative transition-all hover:shadow-lg">
                            <button 
                                onClick={() => handleRemoveTask(task.tempId)}
                                className="absolute top-3 right-3 text-slate-400 hover:text-status-danger transition-colors p-1.5 rounded-full hover:bg-red-500/10"
                                aria-label={`Descartar tarea: ${task.description}`}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-4">
                                <div>
                                    <label htmlFor={`description-${task.tempId}`} className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        Descripción de la Tarea
                                    </label>
                                    <textarea
                                        id={`description-${task.tempId}`}
                                        value={task.description}
                                        onChange={(e) => handleTaskChange(task.tempId, 'description', e.target.value)}
                                        className={`${inputBaseStyles} resize-y min-h-[80px]`}
                                        rows={3}
                                    />
                                </div>
                                 {task.documents && task.documents.length > 0 && (
                                    <div className="mt-1">
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                            <DocumentTextIcon className="w-5 h-5 text-brand-secondary"/>
                                            Documentos a Generar
                                        </h4>
                                        <ul className="space-y-1.5 pl-1 max-h-24 overflow-y-auto">
                                            {task.documents.map(doc => (
                                                <li key={doc} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-1.5 rounded-md">
                                                    <DocumentTextIcon className="w-4 h-4 text-slate-400 shrink-0"/>
                                                    <span className="flex-1">{doc}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="md:w-72 shrink-0 flex flex-col gap-4">
                                {task.scope && task.scope.level !== 'Institución' && (
                                     <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700">Ámbito de Aplicación</label>
                                        <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-md">
                                            <BuildingOfficeIcon className="w-5 h-5 text-slate-500" />
                                            <p className="text-sm text-slate-700">
                                                <span className="font-medium">{task.scope.level}:</span> {task.scope.entity}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor={`category-${task.tempId}`} className="text-sm font-semibold text-slate-700">Categoría</label>
                                    <input
                                        id={`category-${task.tempId}`}
                                        type="text"
                                        value={(task.scope as TaskScope)?.category ?? ''}
                                        onChange={(e) => {
                                            const newScope = { ...(task.scope as TaskScope), category: e.target.value };
                                            handleTaskChange(task.tempId, 'scope', newScope);
                                        }}
                                        className={inputBaseStyles}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Área Responsable</label>
                                    <EnhancedSelect
                                        value={task.responsible_area_id ? String(task.responsible_area_id) : ''}
                                        onChange={(v)=> handleTaskChange(task.tempId, 'responsible_area_id', v ? Number(v) : null)}
                                        options={availableAreas.map(area=>({ value:String(area.id), label: area.name }))}
                                        placeholder="Seleccionar área"
                                        searchable
                                        clearable
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Persona Responsable</label>
                                    <EnhancedSelect
                                        value={task.responsible_person_id ? String(task.responsible_person_id) : ''}
                                        onChange={(v)=> handleTaskChange(task.tempId, 'responsible_person_id', v || null)}
                                        options={availablePersons.map(p=>({ value:p.id, label:p.full_name }))}
                                        placeholder="Seleccionar persona"
                                        searchable
                                        clearable
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor={`date-${task.tempId}`} className="text-sm font-semibold text-slate-700">Fecha Límite</label>
                                    <div className="relative">
                                        <input
                                            id={`date-${task.tempId}`}
                                            type="date"
                                            value={(task.scope as TaskScope)?.due_date ?? ''}
                                            onChange={(e) => {
                                                const newScope = { ...(task.scope as TaskScope), due_date: e.target.value };
                                                handleTaskChange(task.tempId, 'scope', newScope);
                                            }}
                                            className={`${inputBaseStyles} pr-10`}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <CalendarIcon className="h-5 w-5 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                     {editedTasks.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-slate-300">
                            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2-2H5a2 2 0 01-2-2z" />
                            </svg>
                            <h3 className="mt-2 text-lg font-medium text-slate-800">No hay tareas para revisar</h3>
                            <p className="mt-1 text-sm text-slate-500">Todas las tareas han sido descartadas. Puede cerrar esta ventana.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white/70 backdrop-blur-sm border-t border-slate-200 flex justify-end items-center gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={editedTasks.length === 0}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary focus:outline-none focus:ring-4 focus:ring-blue-400/50 transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        Guardar {editedTasks.length > 0 ? editedTasks.length : ''} Tarea{editedTasks.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TasksReviewModal;