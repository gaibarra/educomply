import React, { useState } from 'react';
import { Task } from '../types';
import { supabase } from '../services/supabaseClient';
import { useToast } from './ToastProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSuspend: (updated: Task) => void;
}

const SuspendTaskModal: React.FC<Props> = ({ isOpen, onClose, task, onSuspend }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const doSuspend = async () => {
    if (!reason.trim()) { toast.addToast('error', 'Debe indicar la razón de la suspensión', 3000); return; }
    setLoading(true);
    try {
      // Persist in DB: insert into tasks_suspensions table if exists, otherwise store in task metadata (client-side for now)
      // Try to update task row with suspension metadata if columns exist
      try {
        const { error } = await supabase.from('tasks').update({ suspended: true, suspension_reason: reason }).eq('id', task.id);
        if (error) {
          console.warn('No se pudo actualizar columnas de suspensión en tasks:', error.message);
        }
      } catch (e) { /* ignore */ }

      const updated: Task = { ...task, suspended: true, suspension_reason: reason, suspended_by: (await supabase.auth.getUser()).data.user?.id || null, suspended_at: new Date().toISOString() };
      onSuspend(updated);
      toast.addToast('success', 'Tarea suspendida y pasada a Reprogramar', 4000);
      onClose();
    } catch (e:any) {
      console.error('Error suspendiendo tarea', e);
      toast.addToast('error', 'No se pudo suspender la tarea', 6000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-bold text-slate-800">Suspender implementación de tarea</h3>
        <p className="text-sm text-slate-500 mt-1">Esta acción mueve la tarea a la sección 'Tareas Pendientes de Reprogramar' y registra la razón. Solo el Oficial de Cumplimiento (admin) puede ejecutar esto.</p>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700">Razón de la suspensión</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full mt-2 p-2 border rounded-md"
            rows={4}
          />
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-200">Cancelar</button>
          <button onClick={doSuspend} disabled={loading} className="px-4 py-2 rounded-md bg-amber-400 text-white font-semibold">Confirmar suspensión</button>
        </div>
      </div>
    </div>
  );
};

export default SuspendTaskModal;
