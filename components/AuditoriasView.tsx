import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useToast } from './ToastProvider';
import type { Audit, Profile, InstitutionProfileRow, AuditFinding } from '../types';
import CreateAuditModal from './CreateAuditModal';
import AuditCard from './AuditCard';
import AuditsDashboard from './AuditsDashboard'; // Importar el nuevo dashboard

// Normalizador para garantizar defaults seguros
function normalizeAudit(a: any): Audit {
  const findings: AuditFinding[] = Array.isArray(a.findings)
    ? a.findings
    : Array.isArray(a.audit_findings)
    ? a.audit_findings
    : [];
  return {
    ...a,
    findings,
    phase_log: a.phase_log ?? [],
    phase_activities: a.phase_activities ?? {},
  };
}

const AuditDetailModal: React.FC<{ auditId: string; onClose: () => void; onUpdate: () => void }> = ({
  auditId,
  onClose,
  onUpdate,
}) => {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_audit_details', { p_audit_id: auditId });
      if (error) throw error;
      setDetails(data);
    } catch (e: any) {
      toast.addToast('error', `Error al cargar detalles: ${e.message}`, 5000);
    } finally {
      setLoading(false);
    }
  }, [auditId, toast]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleActivityToggle = async (activity: any) => {
    try {
      const { error } = await supabase.rpc('update_audit_activity', {
        p_activity_id: activity.id,
        p_completed: !activity.completed,
        p_notes: activity.notes || '',
      });
      if (error) throw error;
      toast.addToast('success', 'Actividad actualizada.', 3000);
      fetchDetails();
    } catch (e: any) {
      toast.addToast('error', `No se pudo actualizar: ${e.message}`, 5000);
    }
  };

  const renderPhaseActivities = (phase: string) => {
    const activities: any[] = details?.activities?.filter((a: any) => a.phase === phase) || [];
    if (activities.length === 0) return <p className="text-gray-400 text-sm">No hay actividades definidas para esta fase.</p>;

    return (
      <ul className="space-y-2">
        {activities.map((activity) => (
          <li key={activity.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
            <input
              type="checkbox"
              checked={activity.completed}
              onChange={() => handleActivityToggle(activity)}
              className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-600"
            />
            <span className={`flex-1 ${activity.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
              {activity.description}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  if (loading) return <div className="p-8 text-center">Cargando detalles...</div>;
  if (!details) return <div className="p-8 text-center text-red-400">No se pudieron cargar los detalles de la auditoría.</div>;

  const { audit, auditor, findings, history } = details;
  const phases = ['planificacion', 'ejecucion', 'evaluacion', 'seguimiento'];
  const currentPhaseIndex = phases.indexOf(audit.current_phase || 'planificacion');

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-2xl font-bold text-white">{audit.name}</h3>
          <p className="text-gray-400">Auditor: {auditor?.full_name || 'No asignado'}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <ol className="flex items-center w-full">
              {phases.map((phase, index) => (
                <li
                  key={phase}
                  className={`flex w-full items-center ${
                    index < phases.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ''
                  } ${index <= currentPhaseIndex ? 'text-blue-500 after:border-blue-700' : 'text-gray-500 after:border-gray-700'}`}
                >
                  <span className="flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 bg-gray-800 border border-current">
                    {index + 1}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">Actividades de la Fase: {audit.current_phase}</h4>
              {renderPhaseActivities(audit.current_phase || 'planificacion')}

              <h4 className="text-xl font-semibold text-white mt-8 mb-4">Hallazgos ({findings?.length || 0})</h4>
              {findings && findings.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {findings.map((f: any) => (
                    <li key={f.id} className="p-2 bg-gray-800 rounded">
                      {f.description} ({f.severity})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">No hay hallazgos registrados.</p>
              )}
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">Historial</h4>
              {history && history.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {history.map((h: any) => (
                    <li key={h.id} className="border-l-2 border-gray-600 pl-3">
                      <p className="font-semibold text-gray-300">{h.event_type.replace(/_/g, ' ')}</p>
                      <p className="text-gray-400">
                        {h.actor_name} - {new Date(h.created_at).toLocaleString()}
                      </p>
                      {h.detail && <p className="text-xs text-gray-500 mt-1">Detalle: {JSON.stringify(h.detail)}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">No hay historial de eventos.</p>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white">
            Cerrar
          </button>
          <button className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold">Avanzar Fase</button>
        </div>
      </div>
    </div>
  );
};

export default function AuditoriasView({
  profile,
  institutionProfile,
}: {
  profile: Profile;
  institutionProfile: InstitutionProfileRow | null;
}) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [allAuditors, setAllAuditors] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list'); // Estado para la vista
  const toast = useToast();

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [auditsRes, usersRes] = await Promise.all([
        supabase
          .from('audits')
          .select(
            `
            *,
            auditor:auditor_id(id, full_name),
            findings:audit_findings(*)
          `
          )
          .order('start_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
      ]);

      const { data: auditsData, error: auditsError } = auditsRes;
      const { data: usersData, error: usersError } = usersRes;

      if (auditsError) throw auditsError;
      if (usersError) throw usersError;

      setAudits((auditsData || []).map(normalizeAudit));
      setAllAuditors((usersData || []) as Profile[]);
    } catch (e: any) {
      setError(e.message);
      toast.addToast('error', 'No se pudieron cargar las auditorías.', 5000);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const handleUpdateAudit = (updatedAudit: Audit) => {
    setAudits((prev) => prev.map((a) => (a.id === updatedAudit.id ? normalizeAudit(updatedAudit) : a)));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Auditorías</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Lista
            </button>
            <button 
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Dashboard
            </button>
          </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg">
            + Crear Auditoría
          </button>
        </div>
      </div>

      {loading && <p>Cargando auditorías...</p>}
      {error && <div className="text-red-400 p-4 bg-red-500/10 rounded-md">{error}</div>}

      {!loading && !error && (
        <>
          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {audits.map((audit) => (
                <AuditCard key={audit.id} audit={audit} onUpdateAudit={handleUpdateAudit} />
              ))}
            </div>
          ) : (
            <AuditsDashboard />
          )}
        </>
      )}

      {selectedAuditId && (
        <AuditDetailModal auditId={selectedAuditId} onClose={() => setSelectedAuditId(null)} onUpdate={fetchAudits} />
      )}

      {isCreateModalOpen && (
        <CreateAuditModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(newAuditId) => {
            setIsCreateModalOpen(false);
            fetchAudits();
            toast.addToast('success', `Auditoría #${newAuditId} creada exitosamente.`, 4000);
          }}
          auditors={allAuditors}
          institutionProfile={institutionProfile}
        />
      )}
    </div>
  );
}
