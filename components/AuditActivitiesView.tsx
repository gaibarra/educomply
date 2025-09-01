
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Audit, AuditPhaseKey, AuditPhaseActivityRow, AuditPhaseSubActivityRow } from '../types';
import { useToast } from './ToastProvider';
import { generateSubActivities } from '../services/geminiService';

// UI activity type used in the editor
interface UIActivity {
  key: string;
  id?: number;
  title: string;
  completed?: boolean;
  notes?: string | null;
  subActivities: AuditPhaseSubActivityRow[];
}

const mapDbRowToUi = (row: AuditPhaseActivityRow, subActivities: AuditPhaseSubActivityRow[]): UIActivity => ({
  key: String(row.id ?? JSON.stringify(row)),
  id: row.id,
  title: row.description ?? `Actividad ${row.id ?? ''}`,
  completed: !!row.completed,
  notes: row.notes ?? null,
  subActivities: subActivities.filter(sa => sa.activity_id === row.id),
});

interface AuditActivitiesViewProps {
  audit: Audit;
  onClose: () => void;
  onUpdateAudit: (updatedAudit: Audit) => void;
}

const AuditActivitiesView: React.FC<AuditActivitiesViewProps> = ({ audit, onClose, onUpdateAudit }) => {
  const [activities, setActivities] = useState<Record<AuditPhaseKey, UIActivity[]>>({ 
    planificacion: [], ejecucion: [], evaluacion: [], seguimiento: [] 
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AuditPhaseKey>(audit.current_phase || 'planificacion');
  const { addToast } = useToast();

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('audit_phase_activities')
        .select('*')
        .eq('audit_id', audit.id)
        .order('id', { ascending: true });

      if (activitiesError) throw activitiesError;

      const activityIds = activitiesData.map(a => a.id);
      const { data: subActivitiesData, error: subActivitiesError } = await supabase
        .from('audit_phase_sub_activities')
        .select('*')
        .in('activity_id', activityIds);

      if (subActivitiesError) throw subActivitiesError;

      const groupedActivities = (activitiesData || []).reduce((acc, activity) => {
        const phase = activity.phase as AuditPhaseKey;
        if (!acc[phase]) {
          acc[phase] = [];
        }
        acc[phase].push(mapDbRowToUi(activity, subActivitiesData || []));
        return acc;
      }, {} as Record<AuditPhaseKey, UIActivity[]>);

      setActivities({
        planificacion: [], ejecucion: [], evaluacion: [], seguimiento: [],
        ...groupedActivities
      });
    } catch (e: any) {
      addToast('error', `Error al cargar actividades: ${e.message}`);
    } finally {
      setLoading(false);
    }
  // NOTE: deliberately omitting addToast from deps to avoid effect storm when the toast provider returns a new fn per render (seen in tests)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit.id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleSaveChanges = async (phase: AuditPhaseKey) => {
    const phaseActivities = activities[phase];
    const activitiesToUpsert = phaseActivities.map(a => ({
      id: a.id,
      audit_id: audit.id,
      phase: phase,
      description: a.title,
      completed: a.completed,
      notes: a.notes,
    }));

    const subActivitiesToUpsert = phaseActivities.flatMap(a => a.subActivities).map(sa => ({
        id: sa.id,
        activity_id: sa.activity_id,
        description: sa.description,
        start_date: sa.start_date,
        end_date: sa.end_date,
        completed: sa.completed,
    }));

    try {
      const { error: actError } = await supabase.from('audit_phase_activities').upsert(activitiesToUpsert, { onConflict: 'id' });
      if (actError) throw actError;

      const { error: subActError } = await supabase.from('audit_phase_sub_activities').upsert(subActivitiesToUpsert, { onConflict: 'id' });
      if (subActError) throw subActError;

      addToast('success', 'Actividades guardadas exitosamente');
      fetchActivities();
    } catch (e: any) {
      addToast('error', `Error al guardar: ${e.message}`);
    }
  };

  const handleActivityChange = (phase: AuditPhaseKey, updatedActivity: UIActivity) => {
    setActivities(prev => ({
      ...prev,
      [phase]: prev[phase].map(a => a.key === updatedActivity.key ? updatedActivity : a)
    }));
  };

  const handleSubActivityChange = (phase: AuditPhaseKey, activityId: number, updatedSubActivity: AuditPhaseSubActivityRow) => {
    setActivities(prev => ({
        ...prev,
        [phase]: prev[phase].map(a => 
            a.id === activityId 
                ? { ...a, subActivities: a.subActivities.map(sa => sa.id === updatedSubActivity.id ? updatedSubActivity : sa) } 
                : a
        )
    }));
  };

  const handleAddActivity = (phase: AuditPhaseKey) => {
    const newActivity: UIActivity = {
      key: `new-${Date.now()}`,
      title: 'Nueva actividad',
      completed: false,
      notes: '',
      subActivities: [],
    };
    setActivities(prev => ({
      ...prev,
      [phase]: [...prev[phase], newActivity]
    }));
  };

  const handleDeleteActivity = async (phase: AuditPhaseKey, activityId?: number) => {
    if (!activityId) return;
    if (!confirm('¿Eliminar esta actividad?')) return;

    try {
      const { error } = await supabase.from('audit_phase_activities').delete().eq('id', activityId);
      if (error) throw error;
      addToast('success', 'Actividad eliminada');
      fetchActivities();
    } catch (e: any) {
      addToast('error', `Error al eliminar: ${e.message}`);
    }
  };

  const handleGenerateSubActivities = async (activity: UIActivity) => {
    if (!activity.id) {
      addToast('error', 'Actividad no tiene ID válido');
      return;
    }

    console.log('[handleGenerateSubActivities] Starting for activity:', activity.title);
    setGenerating(activity.id);

    try {
      console.log('[handleGenerateSubActivities] Calling generateSubActivities...');
      const { subActivities } = await generateSubActivities(activity.title);
      console.log('[handleGenerateSubActivities] Received sub-activities:', subActivities);

      if (!subActivities || subActivities.length === 0) {
        throw new Error('No se generaron sub-actividades');
      }

      const newSubActivities = subActivities.map(sa => ({
        ...sa,
        activity_id: activity.id,
        completed: false,
        audit_id: audit.id,
        phase: activeTab
      }));

      // Optimistic UI: mostrar inmediatamente antes de persistir
      const optimistic = newSubActivities.map((sa, i) => ({
        id: `temp-${Date.now()}-${i}` as any,
        description: sa.description,
        start_date: sa.start_date,
        end_date: sa.end_date,
        activity_id: sa.activity_id,
        completed: false
      }));
      setActivities(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(a =>
          a.id === activity.id
            ? { ...a, subActivities: [...a.subActivities, ...optimistic] }
            : a
        )
      }));

      console.log('[handleGenerateSubActivities] Inserting sub-activities:', newSubActivities);
      const { data: insertedSubActivities, error } = await supabase
        .from('audit_phase_sub_activities')
        .insert(newSubActivities as any)
        .select();

      if (error) {
        console.error('[handleGenerateSubActivities] Database error:', error);
        // Revert optimistic entries
        setActivities(prev => ({
          ...prev,
          [activeTab]: prev[activeTab].map(a =>
            a.id === activity.id
              ? { ...a, subActivities: a.subActivities.filter(sa => !(typeof sa.id === 'string' && String(sa.id).startsWith('temp-'))) }
              : a
          )
        }));
        throw new Error(`Error guardando en base de datos: ${error.message}`);
      }

      console.log('[handleGenerateSubActivities] Successfully inserted:', insertedSubActivities);

      // Reemplazar optimistic con resultados reales
      setActivities(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(a =>
          a.id === activity.id
            ? {
                ...a,
                subActivities: [
                  ...a.subActivities.filter(sa => !(typeof sa.id === 'string' && String(sa.id).startsWith('temp-'))),
                  ...(insertedSubActivities || [])
                ]
              }
            : a
        )
      }));

      addToast('success', `Se generaron ${subActivities.length} sub-actividades exitosamente`);

    } catch (e: any) {
      console.error('[handleGenerateSubActivities] Error:', e);
      addToast('error', `Error al generar sub-actividades: ${e.message}`);
    } finally {
      setGenerating(null);
    }
  };

  const phaseTabs: { key: AuditPhaseKey, name: string }[] = [
    { key: 'planificacion', name: 'Planificación' },
    { key: 'ejecucion', name: 'Ejecución' },
    { key: 'evaluacion', name: 'Evaluación' },
    { key: 'seguimiento', name: 'Seguimiento' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-2xl font-bold text-white">Actividades de la Auditoría: {audit.name}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="border-b border-gray-700 mb-4">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {phaseTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <p>Cargando actividades...</p>
          ) : (
            <div>
              {activities[activeTab].map(activity => (
                <div key={activity.key} className="p-4 bg-gray-800 rounded mb-4">
                  <div className="flex items-start gap-4">
                    <input 
                      type="checkbox" 
                      checked={activity.completed}
                      onChange={(e) => handleActivityChange(activeTab, { ...activity, completed: e.target.checked })}
                      className="h-5 w-5 mt-1 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-600"
                    />
                    <div className="flex-1">
                      <textarea 
                        value={activity.title}
                        onChange={(e) => handleActivityChange(activeTab, { ...activity, title: e.target.value })}
                        className="w-full bg-transparent text-white focus:outline-none resize-none"
                        rows={2}
                      />
                      <textarea 
                        value={activity.notes || ''}
                        onChange={(e) => handleActivityChange(activeTab, { ...activity, notes: e.target.value })}
                        className="w-full bg-gray-700/50 mt-2 p-2 rounded text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Agregar comentarios..."
                        rows={3}
                      />
                    </div>
                    <button onClick={() => handleDeleteActivity(activeTab, activity.id)} className="text-red-500 hover:text-red-400 font-semibold">
                      Eliminar
                    </button>
                  </div>
                  <div className="mt-4 pl-10">
                    <h4 className="text-lg font-semibold text-white mb-2">Sub-actividades</h4>
                    {activity.subActivities.map(sa => (
                      <div key={sa.id} className="flex items-center gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          checked={sa.completed} 
                          onChange={(e) => handleSubActivityChange(activeTab, activity.id!, { ...sa, completed: e.target.checked })}
                          className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500" 
                        />
                        <span className="flex-1 text-sm text-gray-300">{sa.description}</span>
                        <span className="text-xs text-gray-400">{sa.start_date} - {sa.end_date}</span>
                      </div>
                    ))}
                    <button 
                      onClick={() => handleGenerateSubActivities(activity)}
                      className="mt-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-3 py-1 rounded-md text-sm"
                      disabled={generating === activity.id}
                    >
                      {generating === activity.id ? 'Generando...' : 'Generar Sub-actividades'}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => handleAddActivity(activeTab)} className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg">
                + Agregar Actividad
              </button>
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white">
            Cerrar
          </button>
          <button onClick={() => handleSaveChanges(activeTab)} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditActivitiesView;
