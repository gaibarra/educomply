import React, { useState, useMemo } from 'react';
import type { SubTask, Profile } from '../types';
import SubTaskItem from './SubTaskItem';

const SubtaskList: React.FC<{
    subtasks: SubTask[];
    onUpdateSubtask: (s: SubTask) => void;
    onDeleteSubtask: (id: string) => void;
    onAdd?: () => void;
    availableTeamMembers: Profile[];
    currentUserProfile: Profile;
}> = ({ subtasks, onUpdateSubtask, onDeleteSubtask, onAdd, availableTeamMembers, currentUserProfile }) => {
    const [expanded, setExpanded] = useState(subtasks.length <= 2);

    const completed = useMemo(() => subtasks.filter(s => s.status === 'Completada').length, [subtasks]);

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <h4 className="text-base font-medium text-slate-100">Plan de Acción y Sub-tareas</h4>
                    <span className="text-sm text-slate-300">{subtasks.length} subtarea{subtasks.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-sm text-slate-300">Progreso: <span className="font-semibold text-slate-100">{Math.round(subtasks.length ? (completed / subtasks.length) * 100 : 0)}%</span></div>
            </div>

            <div className="rounded-lg border bg-sky-400/8 border-sky-400/20 p-3">
                <div className="flex flex-col">
                    {(expanded ? subtasks : subtasks.slice(0, 2)).map((subtask, index) => (
                        <SubTaskItem
                            key={subtask.id}
                            subTask={subtask}
                            onUpdate={onUpdateSubtask}
                            onDelete={onDeleteSubtask}
                            availableTeamMembers={availableTeamMembers}
                            isLastItem={index === subtasks.length - 1}
                            currentUserProfile={currentUserProfile}
                        />
                    ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between">
                    <div>
                        {onAdd && (
                            <button onClick={onAdd} className="flex items-center gap-2 text-sm font-semibold text-slate-100 hover:text-white transition-colors">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Agregar Sub-tarea
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {subtasks.length > 2 && (
                            <button onClick={() => setExpanded(e => !e)} className="text-sm text-slate-300 hover:text-slate-100">
                                {expanded ? `Mostrar menos` : `Ver todas ${subtasks.length}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubtaskList;
