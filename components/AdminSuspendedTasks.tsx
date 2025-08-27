import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useToast } from './ToastProvider';

type SuspendedTaskRow = {
  id: string;
  title: string | null;
  owner_id: string | null;
  owner_name: string | null;
  responsible_person_id: string | null;
  responsible_name: string | null;
  suspended_by: string | null;
  suspended_by_name: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  scope: any;
  created_at: string | null;
  updated_at: string | null;
  total_count?: number;
};

export default function AdminSuspendedTasks() {
  const [rows, setRows] = useState<SuspendedTaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SuspendedTaskRow | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 10;
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_suspended_tasks', {
        p_search_term: search,
        p_page_num: page,
        p_page_size: pageSize
      });
      if (rpcError) throw rpcError;
      const result = (data || []) as SuspendedTaskRow[];
      setRows(result);
      setTotalCount(result.length > 0 ? result[0].total_count || 0 : 0);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReprogram(task: SuspendedTaskRow) {
    if (!newDueDate) {
      setModalError('Selecciona una nueva fecha antes de reprogramar');
      return;
    }
    setLoading(true);
    setModalError(null);
    try {
      const ts = new Date(newDueDate).toISOString();
      const { error: rpcError } = await supabase.rpc('reprogram_task', { p_task_id: task.id, p_new_due_date: ts });
      if (rpcError) throw rpcError;
      toast.addToast('success', 'Tarea reprogramada y reanudada con éxito.', 4000);
      await load();
      setSelected(null);
      setNewDueDate('');
    } catch (e: any) {
      setModalError(e?.message || String(e));
      toast.addToast('error', 'No se pudo reprogramar la tarea.', 5000);
    } finally { setLoading(false); }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 text-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-slate-100">Tareas suspendidas pendientes de reprogramar</h3>

      <div className="flex gap-2 mb-3">
        <input
          placeholder="Buscar por título o propietario..."
          className="border border-gray-600 bg-gray-800 p-2 rounded flex-1 text-gray-200 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setPage(1)}
        />
        <div className="w-36">
          <select className="border border-gray-600 bg-gray-800 p-2 rounded w-full text-gray-200" value={pageSize} disabled>
            <option className="bg-gray-800 text-gray-200">{pageSize} por página</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-300"> 
          <svg className="animate-spin h-5 w-5 text-slate-200" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none"/></svg>
          Cargando...
        </div>
      )}
      {error && <div className="text-rose-400">{error}</div>}
      {!loading && rows.length === 0 && <div className="text-slate-300">No hay tareas suspendidas pendientes de reprogramar.</div>}

      <ul className="space-y-3">
        {rows.map(r => (
          <li key={r.id} className="border border-gray-700 p-4 rounded-lg flex justify-between items-start bg-gray-800/50">
            <div>
              <div className="font-medium text-slate-100">{r.title}</div>
              <div className="text-sm text-slate-300">Propietario: {r.owner_name || '—'}</div>
              <div className="text-sm text-slate-300">Motivo: {r.suspension_reason || '—'}</div>
              <div className="text-sm text-slate-300">Suspendida: {r.suspended_at || '—'}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors"
                onClick={() => { setSelected(r); setNewDueDate(''); setModalError(null); }}
              >
                Reprogramar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-slate-300">Mostrando {rows.length} de {totalCount} resultado(s)</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded border-gray-600 text-slate-200 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
          <div className="px-3 text-slate-200">{page} / {totalPages}</div>
          <button className="px-2 py-1 border rounded border-gray-600 text-slate-200 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
        </div>
      </div>

      {/* Modal / panel de reprogramación */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!loading) { setSelected(null); setNewDueDate(''); setModalError(null); } }} />
          <div className="bg-gray-900 text-gray-200 rounded-lg shadow-xl p-6 z-10 w-full max-w-md border border-gray-700">
            <h4 className="font-semibold">Reprogramar: {selected.title}</h4>
            <div className="text-sm text-slate-300">Propietario: {selected.owner_name || '—'}</div>
            <label className="block text-sm text-slate-200 mt-3">Nueva fecha y hora</label>
            <input type="datetime-local" className="border border-gray-600 bg-gray-800 p-2 rounded w-full mt-1 text-gray-200"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)} />

            <div className="flex gap-2 mt-4 justify-end">
              <button className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded transition-colors" onClick={() => { setSelected(null); setNewDueDate(''); setModalError(null); }} disabled={loading}>Cancelar</button>
              <button className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded flex items-center gap-2 transition-colors" onClick={() => handleReprogram(selected)} disabled={loading}>
                {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none"/></svg>}
                Guardar y reanudar
              </button>
            </div>
            {modalError && <div className="text-rose-400 mt-2">{modalError}</div>}
          </div>
        </div>
      )}

    </div>
  );
}
