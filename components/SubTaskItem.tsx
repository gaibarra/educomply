import React, { useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { SubTask, TaskStatus, TaskComment, AttachedDocument, Profile, Database } from '../types';
import ChatBubbleLeftRightIcon from './icons/ChatBubbleLeftRightIcon';
import PaperClipIcon from './icons/PaperClipIcon';
import DownloadIcon from './icons/DownloadIcon';
import TrashIcon from './icons/TrashIcon';
import StatusIcon from './icons/StatusIcon';

interface SubTaskItemProps {
    subTask: SubTask;
    onUpdate: (updatedSubTask: SubTask) => void;
    onDelete: (subTaskId: number) => void;
    availableTeamMembers: Profile[];
    isLastItem: boolean;
    currentUserProfile: Profile;
}

const SubTaskItem: React.FC<SubTaskItemProps> = ({ subTask, onUpdate, onDelete, availableTeamMembers, isLastItem, currentUserProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isEditing, setIsEditing] = useState(subTask.description === '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpdateField = async (
        updates: Database['public']['Tables']['sub_tasks']['Update']
    ) => {
        // Optimistic update
        const updatedSubTask = { ...subTask, ...updates };
        if ('assigned_to_id' in updates) {
            const assignee = availableTeamMembers.find(p => p.id === updates.assigned_to_id);
            updatedSubTask.assigned_to = assignee || null;
        }
        onUpdate(updatedSubTask as SubTask);

        // Update the database in the background.
        const { error } = await supabase
            .from('sub_tasks')
            .update(updates)
            .eq('id', subTask.id);

        if (error) {
            console.error(`Error updating subtask:`, error);
            // Optional: Implement a rollback or show a persistent error message.
            alert(`Error: No se pudo actualizar la sub-tarea. ${error.message}`);
            // Revert on error
            onUpdate(subTask);
        }
    };


    const handleStatusChange = () => {
        const nextStatusMap: Record<TaskStatus, TaskStatus> = {
            'Pendiente': 'En Progreso',
            'En Progreso': 'Completada',
            'Completada': 'Pendiente',
        };
        handleUpdateField({ status: nextStatusMap[subTask.status] });
    };

    const handleDescriptionBlur = () => {
        if (subTask.description.trim() !== '') {
            setIsEditing(false);
            handleUpdateField({ description: subTask.description });
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Update the parent state on every keystroke to keep the component controlled.
        onUpdate({ ...subTask, description: e.target.value });
    };
    
    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        const newCommentPayload: Database['public']['Tables']['comments']['Insert'] = {
            sub_task_id: subTask.id,
            author_id: currentUserProfile.id,
            author_name: currentUserProfile.full_name, // denormalized
            text: newComment.trim(),
        };
        const { data: newCommentData, error } = await supabase
            .from('comments')
            .insert([newCommentPayload])
            .select()
            .single();
        
        if (error) {
            console.error('Error adding comment:', error);
        } else if (newCommentData) {
            onUpdate({ ...subTask, comments: [...subTask.comments, newCommentData] });
            setNewComment('');
            setShowComments(true);
        }
    };

    const handleAttachClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files as FileList | null;
        if (!fileList || fileList.length === 0) return;

        const uploadPromises = Array.from(fileList).map(async (file: File) => {
            const filePath = `${subTask.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('task_documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('task_documents')
                .getPublicUrl(filePath);

            return {
                sub_task_id: subTask.id,
                name: file.name,
                url: urlData.publicUrl,
                storage_path: filePath,
            } as Database['public']['Tables']['documents']['Insert'];
        });

        try {
            const newDocsToInsert = await Promise.all(uploadPromises);
            const { data: newDocuments, error } = await supabase
                .from('documents')
                .insert(newDocsToInsert)
                .select();

            if (error) throw error;
            if (newDocuments) {
                onUpdate({ ...subTask, documents: [...subTask.documents, ...newDocuments] });
            }
        } catch (err) {
            console.error('Error uploading files:', err);
        }

        if (event.target) event.target.value = '';
    };

    const handleDeleteDocument = async (doc: AttachedDocument) => {
        const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id);
        if (deleteError) {
             console.error('Error deleting document record:', deleteError);
             return;
        }
        const { error: storageError } = await supabase.storage.from('task_documents').remove([doc.storage_path]);
        if (storageError) {
             console.error('Error deleting file from storage:', storageError);
        }
        onUpdate({ ...subTask, documents: subTask.documents.filter(d => d.id !== doc.id) });
    };
    
    const isCompleted = subTask.status === 'Completada';
    
    return (
        <div className="relative group">
            {!isLastItem && <div className="absolute left-[13px] top-7 h-full w-0.5 bg-slate-200" />}

            <div className="relative flex items-start gap-x-4 py-2">
                <StatusIcon status={subTask.status} onClick={handleStatusChange} />

                <div className="flex-1 pt-0.5 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                        {isEditing ? (
                             <input
                                type="text"
                                value={subTask.description}
                                onChange={handleDescriptionChange}
                                onBlur={handleDescriptionBlur}
                                onKeyDown={(e) => e.key === 'Enter' && handleDescriptionBlur()}
                                placeholder="Describa la nueva sub-tarea..."
                                className="flex-grow p-1.5 border rounded-md text-sm bg-white border-slate-300 text-slate-800 font-medium w-full"
                                autoFocus
                            />
                        ) : (
                            <p onClick={() => setIsEditing(true)} className={`flex-grow font-medium text-slate-800 cursor-text transition-colors ${isCompleted ? 'line-through text-slate-500' : 'hover:text-brand-primary'}`}>
                                {subTask.description || "Sin descripción"}
                            </p>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                            <button onClick={handleAttachClick} className="text-slate-500 hover:text-brand-secondary transition-colors p-1.5 rounded-full hover:bg-slate-100" aria-label="Adjuntar archivo"><PaperClipIcon className="w-5 h-5"/></button>
                            <button onClick={() => setShowComments(!showComments)} className="text-slate-500 hover:text-brand-secondary transition-colors p-1.5 rounded-full hover:bg-slate-100 relative" aria-label="Ver comentarios">
                                <ChatBubbleLeftRightIcon className="w-5 h-5"/>
                                {subTask.comments.length > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-status-danger text-white text-[9px]">{subTask.comments.length}</span>}
                            </button>
                            <button onClick={() => onDelete(subTask.id)} className="text-slate-400 hover:text-status-danger transition-colors p-1.5 rounded-full hover:bg-red-50" aria-label="Eliminar sub-tarea"><TrashIcon className="h-5 h-5" /></button>
                        </div>
                    </div>
                     <div className="mt-2 text-sm">
                        <select
                            value={subTask.assigned_to_id ?? ''}
                            onChange={(e) => handleUpdateField({ assigned_to_id: e.target.value || null })}
                            className="p-1 -ml-1 border border-transparent rounded-md text-slate-600 bg-transparent hover:bg-slate-100 hover:border-slate-300 focus:ring-1 focus:ring-brand-secondary focus:bg-white"
                        >
                            <option value="">Sin asignar</option>
                            {availableTeamMembers.map(person => (
                                <option key={person.id} value={person.id}>{person.full_name}</option>
                            ))}
                        </select>
                    </div>

                    {(showComments || (subTask.documents && subTask.documents.length > 0)) && (
                         <div className="mt-4 p-3 bg-slate-50/70 rounded-md border border-slate-200/80 space-y-4 animate-fade-in">
                            {subTask.documents && subTask.documents.length > 0 && (
                                <div>
                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Adjuntos</h5>
                                    <div className="mt-2 space-y-2">
                                        {subTask.documents.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between gap-2 bg-white p-1.5 pl-2.5 rounded-md border border-slate-200">
                                                 <div className="flex items-center gap-2 overflow-hidden">
                                                    <PaperClipIcon className="w-4 h-4 text-slate-500 shrink-0" />
                                                    <span className="text-sm text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                                                </div>
                                                <div className="flex items-center shrink-0">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-500 hover:text-brand-secondary rounded-full hover:bg-slate-100 transition" aria-label={`Descargar ${doc.name}`}><DownloadIcon className="w-4 h-4" /></a>
                                                    <button onClick={() => handleDeleteDocument(doc)} className="p-1.5 text-slate-500 hover:text-status-danger rounded-full hover:bg-slate-100 transition" aria-label={`Eliminar ${doc.name}`}><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showComments && (
                                <div className="pt-2">
                                     <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Comentarios</h5>
                                     <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                        {subTask.comments.length > 0 ? subTask.comments.map(comment => (
                                             <div key={comment.id} className="text-xs bg-white p-2 rounded-md border border-slate-200">
                                                <p className="text-slate-800">{comment.text}</p>
                                                <p className="text-right text-slate-400 mt-1">- <span className="font-semibold">{comment.author_name}</span>, {new Date(comment.created_at).toLocaleString('es-MX')}</p>
                                            </div>
                                        )) : <p className="text-xs text-slate-400 italic">No hay comentarios aún.</p>}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder="Añadir un comentario..." className="flex-grow p-2 border border-slate-300 rounded-md text-sm" />
                                        <button onClick={handleAddComment} className="bg-brand-secondary text-white font-semibold px-4 py-2 rounded-md hover:bg-brand-primary transition-colors text-sm">Enviar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubTaskItem;