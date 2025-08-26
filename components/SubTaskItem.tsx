import React, { useState, useRef } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { supabase } from '../services/supabaseClient';
import { SubTask, TaskStatus, AttachedDocument, Profile, Database } from '../types';
import ChatBubbleLeftRightIcon from './icons/ChatBubbleLeftRightIcon';
import PaperClipIcon from './icons/PaperClipIcon';
import DownloadIcon from './icons/DownloadIcon';
import TrashIcon from './icons/TrashIcon';
import StatusIcon from './icons/StatusIcon';

interface SubTaskItemProps {
    subTask: SubTask;
    onUpdate: (updatedSubTask: SubTask) => void;
    onDelete: (subTaskId: string) => void;
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
        <div className="relative group font-sans">
            {!isLastItem && <div className="absolute left-[13px] top-7 h-full w-0.5 bg-white/10" />}

            <div className="relative flex items-start gap-x-4 py-2">
                <StatusIcon status={subTask.status} onClick={handleStatusChange} />

                <div className="flex-1 pt-0.5 min-w-0 bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 hover:bg-white/[0.07] transition-colors">
                    <div className="flex justify-between items-center gap-2">
                        {isEditing ? (
                             <input
                                type="text"
                                value={subTask.description}
                                onChange={handleDescriptionChange}
                                onBlur={handleDescriptionBlur}
                                onKeyDown={(e) => e.key === 'Enter' && handleDescriptionBlur()}
                                placeholder="Describa la nueva sub-tarea..."
                                className="flex-grow p-1.5 border rounded-md text-sm bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 font-medium w-full focus:outline-none focus:ring-2 focus:ring-primary"
                                autoFocus
                            />
                        ) : (
                            <p onClick={() => setIsEditing(true)} className={`flex-grow font-medium cursor-text transition-colors ${isCompleted ? 'line-through text-slate-400' : 'text-slate-100 hover:text-white'}`}>
                                {subTask.description || "Sin descripción"}
                            </p>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                            <button onClick={handleAttachClick} className="text-slate-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10" aria-label="Adjuntar archivo"><PaperClipIcon className="w-5 h-5"/></button>
                            <button onClick={() => setShowComments(!showComments)} className="text-slate-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 relative" aria-label="Ver comentarios">
                                <ChatBubbleLeftRightIcon className="w-5 h-5"/>
                                {subTask.comments.length > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-status-danger text-white text-[9px]">{subTask.comments.length}</span>}
                            </button>
                            <button onClick={() => onDelete(subTask.id)} className="text-slate-300 hover:text-status-danger transition-colors p-1.5 rounded-full hover:bg-white/10" aria-label="Eliminar sub-tarea"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                     <div className="mt-2 text-sm">
                        <div className="w-56">
                            <EnhancedSelect
                                value={subTask.assigned_to_id ? String(subTask.assigned_to_id) : ''}
                                onChange={(v)=> handleUpdateField({ assigned_to_id: v || null })}
                                options={[{value:'',label:'Sin asignar'}, ...availableTeamMembers.map(p=>({ value:p.id, label:p.full_name }))]}
                                placeholder="Sin asignar"
                                searchable
                                clearable
                            />
                        </div>
                    </div>

                    {(showComments || (subTask.documents && subTask.documents.length > 0)) && (
                         <div className="mt-4 p-3 bg-white/5 rounded-md border border-white/10 space-y-4 animate-fade-in">
                            {subTask.documents && subTask.documents.length > 0 && (
                                <div>
                                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Adjuntos</h5>
                                    <div className="mt-2 space-y-2">
                                        {subTask.documents.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between gap-2 bg-white/5 p-1.5 pl-2.5 rounded-md border border-white/10">
                                                 <div className="flex items-center gap-2 overflow-hidden">
                                                    <PaperClipIcon className="w-4 h-4 text-slate-300 shrink-0" />
                                                    <span className="text-sm text-slate-100 truncate" title={doc.name}>{doc.name}</span>
                                                </div>
                                                <div className="flex items-center shrink-0">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition" aria-label={`Descargar ${doc.name}`}><DownloadIcon className="w-4 h-4" /></a>
                                                    <button onClick={() => handleDeleteDocument(doc)} className="p-1.5 text-slate-300 hover:text-status-danger rounded-full hover:bg-white/10 transition" aria-label={`Eliminar ${doc.name}`}><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showComments && (
                                <div className="pt-2">
                                     <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Comentarios</h5>
                                     <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                        {subTask.comments.length > 0 ? subTask.comments.map(comment => (
                                             <div key={comment.id} className="text-xs bg-white/5 p-2 rounded-md border border-white/10">
                                                <p className="text-slate-100">{comment.text}</p>
                                                <p className="text-right text-slate-400 mt-1">- <span className="font-semibold">{comment.author_name}</span>, {new Date(comment.created_at).toLocaleString('es-MX')}</p>
                                            </div>
                                        )) : <p className="text-xs text-slate-400 italic">No hay comentarios aún.</p>}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder="Añadir un comentario..." className="flex-grow p-2 border border-white/20 bg-white/10 text-slate-100 placeholder-slate-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                                        <button onClick={handleAddComment} className="text-white font-semibold px-4 py-2 rounded-md transition-colors text-sm" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}>Enviar</button>
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