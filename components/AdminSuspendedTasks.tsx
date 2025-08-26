import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

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
};

export default function AdminSuspendedTasks() {
  const [rows, setRows] = useState<SuspendedTaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SuspendedTaskRow | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_suspended_tasks');
      if (rpcError) throw rpcError;
      setRows((data || []) as SuspendedTaskRow[]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReprogram(task: SuspendedTaskRow) {
    if (!newDueDate) {
      setError('Selecciona una nueva fecha antes de reprogramar');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ts = new Date(newDueDate).toISOString();
      const { error: rpcError } = await supabase.rpc('reprogram_task', { p_task_id: task.id, p_new_due_date: ts });
      if (rpcError) throw rpcError;
      await load();
      setSelected(null);
      setNewDueDate('');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // Filtering + pagination
  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.title || '').toLowerCase().includes(s) || (r.owner_name || '').toLowerCase().includes(s) || (r.responsible_name || '').toLowerCase().includes(s);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-4 bg-white shadow rounded">
      <h3 className="text-lg font-semibold mb-3">Tareas suspendidas pendientes de reprogramar</h3>

      <div className="flex gap-2 mb-3">
        <input placeholder="Buscar por título o propietario..." className="border p-2 rounded flex-1" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <div className="w-36">
          <select className="border p-2 rounded w-full" value={pageSize} disabled>
            <option>{pageSize} por página</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600"> 
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none"/></svg>
          Cargando...
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && filtered.length === 0 && <div>No hay tareas suspendidas pendientes de reprogramar.</div>}

      <ul className="space-y-2">
        {visible.map(r => (
          <li key={r.id} className="border p-2 rounded flex justify-between items-start">
            <div>
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-gray-600">Propietario: {r.owner_name || '—'}</div>
              <div className="text-sm text-gray-600">Motivo: {r.suspension_reason || '—'}</div>
              <div className="text-sm text-gray-600">Suspendida: {r.suspended_at || '—'}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button disabled={loading} className="bg-blue-600 disabled:opacity-50 text-white px-3 py-1 rounded" onClick={() => { setSelected(r); setNewDueDate(''); }}>Reprogramar</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-gray-600">Mostrando {filtered.length} resultado(s)</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
          <div className="px-3">{page} / {totalPages}</div>
          <button className="px-2 py-1 border rounded" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
        </div>
      </div>

      {/* Modal / panel de reprogramación */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => { if (!loading) { setSelected(null); setNewDueDate(''); } }} />
          <div className="bg-white rounded shadow p-4 z-10 w-full max-w-md">
            <h4 className="font-semibold">Reprogramar: {selected.title}</h4>
            <div className="text-sm text-gray-600">Propietario: {selected.owner_name || '—'}</div>
            <label className="block text-sm text-gray-700 mt-3">Nueva fecha y hora</label>
            <input type="datetime-local" className="border p-2 rounded w-full mt-1"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)} />

            <div className="flex gap-2 mt-4 justify-end">
              <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => { setSelected(null); setNewDueDate(''); }} disabled={loading}>Cancelar</button>
              <button className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2" onClick={() => handleReprogram(selected)} disabled={loading}>
                {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none"/></svg>}
                Guardar y reanudar
              </button>
            </div>
            {error && <div className="text-red-600 mt-2">{error}</div>}
          </div>
        </div>
      )}

    </div>
  );
}
