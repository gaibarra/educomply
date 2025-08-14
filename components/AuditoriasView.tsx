
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, Audit, AuditFinding, InstitutionProfileRow, AuditRow, AuditFindingRow } from '../types';
import AuditCard from './AuditCard';
import CreateAuditModal from './CreateAuditModal';
import PlusCircleIcon from './icons/PlusCircleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import EnhancedSelect, { EnhancedSelectOption } from './EnhancedSelect';
import { checkAuditsTable, checkMultipleTables, TableHealth } from '../services/dbHealth';

interface AuditoriasViewProps {
    profile: Profile;
    institutionProfile: InstitutionProfileRow | null;
}


const AuditoriasView: React.FC<AuditoriasViewProps> = ({ profile, institutionProfile }) => {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [auditors, setAuditors] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // null = todas
    const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [schemaHealth, setSchemaHealth] = useState<TableHealth | null>(null);
    const [relatedHealth, setRelatedHealth] = useState<TableHealth[]>([]);
    const [checkingSchema, setCheckingSchema] = useState(false);
    const [showHealth, setShowHealth] = useState(false);

    const phaseOptions: EnhancedSelectOption[] = useMemo(() => [
        { value: 'planificacion', label: 'Planificación' },
        { value: 'ejecucion', label: 'Ejecución' },
        { value: 'evaluacion', label: 'Evaluación' },
        { value: 'seguimiento', label: 'Seguimiento' }
    ], []);
    const statusOptions: EnhancedSelectOption[] = useMemo(() => [
        { value: 'Planificada', label: 'Planificada' },
        { value: 'En Progreso', label: 'En Progreso' },
        { value: 'Completada', label: 'Completada' },
        { value: 'Cancelada', label: 'Cancelada' }
    ], []);

    const fetchAudits = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Because RLS is assumed to be active, we don't need to filter by user role here.
            // The database will only return audits the current user is allowed to see.
            const { data: auditRows, error: auditsError } = await supabase.from('audits').select('*').order('start_date', { ascending: false });
            if (auditsError) throw auditsError;

            if (!auditRows || auditRows.length === 0) {
                setAudits([]);
                setLoading(false);
                return;
            }

            const auditIds = auditRows.map(a => a.id);
            const auditorIds = [...new Set(auditRows.map(a => a.auditor_id).filter(Boolean))];

            // Fetch all related data in parallel
            const [
                { data: findingsData, error: findingsError },
                { data: profilesData, error: profilesError }
            ] = await Promise.all([
                supabase.from('audit_findings').select('*').in('audit_id', auditIds),
                supabase.from('profiles').select('id, full_name, role, scope_entity').in('id', auditorIds)
            ]);
            
            if (findingsError) throw findingsError;
            if (profilesError) throw profilesError;
            
            const typedFindingsData = findingsData as unknown as AuditFindingRow[];
            const typedProfilesData = profilesData as unknown as Profile[];

            // Create lookup maps for efficiency
            const findingsByAuditId = (typedFindingsData || []).reduce((acc, finding) => {
                (acc[finding.audit_id] = acc[finding.audit_id] || []).push(finding as AuditFinding);
                return acc;
            }, {} as Record<number, AuditFinding[]>);
            
            const profilesById = new Map((typedProfilesData || []).map(p => [p.id, p]));

            const combinedAudits: Audit[] = (auditRows as AuditRow[]).map(audit => ({
                ...audit,
                auditor: audit.auditor_id ? profilesById.get(audit.auditor_id) || null : null,
                findings: findingsByAuditId[audit.id] || [],
                current_phase: (audit as any).current_phase || 'planificacion',
                phase_activities: (audit as any).phase_activities || null,
                phase_log: (audit as any).phase_log || [],
            }));
            
            setAudits(combinedAudits);

        } catch (err: any) {
            console.error("Error fetching audits:", err);
            setError(`Error al cargar las auditorías: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch users who can be auditors (e.g., admins or specific roles)
        const fetchAuditors = async () => {
            const { data, error: _profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, role, scope_entity')
                // .in('role', ['admin', 'auditor_role']) // Example filter
                .order('full_name');
            if (data) setAuditors(data as Profile[]);
        };
        fetchAuditors();
        fetchAudits();
    }, [fetchAudits]);

    const handleUpdateAuditInList = (updatedAudit: Audit) => {
        setAudits(prevAudits => prevAudits.map(a => a.id === updatedAudit.id ? updatedAudit : a));
    };

    const filteredAudits = useMemo(() => audits.filter(a => (
        (phaseFilter === null || a.current_phase === phaseFilter) &&
        (statusFilter === null || a.status === statusFilter)
    )), [audits, phaseFilter, statusFilter]);

    return (
        <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Gestión de Auditorías</h2>
                    <p className="text-slate-500">Planifique, ejecute y dé seguimiento a las auditorías de cumplimiento.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="w-48">
                            <EnhancedSelect
                                value={phaseFilter}
                                onChange={(v)=>{ setPhaseFilter(v); setPage(1); }}
                                options={phaseOptions}
                                placeholder="Todas las fases"
                                clearable
                                searchable={false}
                                aria-label="Filtrar por fase"
                            />
                        </div>
                        <div className="w-48">
                            <EnhancedSelect
                                value={statusFilter}
                                onChange={(v)=>{ setStatusFilter(v); setPage(1); }}
                                options={statusOptions}
                                placeholder="Todos los estados"
                                clearable
                                searchable={false}
                                aria-label="Filtrar por estado"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                setExporting(true);
                                try {
                                    const subset = filteredAudits;
                                    const rows = subset.map(a => {
                                        const activitiesArr = Object.values((a.phase_activities||{}));
                                        const activitiesTotal: number = Number(activitiesArr.reduce((acc: number, phase: any) => acc + (Array.isArray(phase?.activities)? phase.activities.length : 0), 0));
                                        const activitiesCompleted: number = Number(activitiesArr.reduce((acc: number, phase: any) => acc + (Array.isArray(phase?.activities)? phase.activities.filter((x:any)=>x.completed).length : 0), 0));
                                        const pct: number = activitiesTotal>0 ? Math.round((activitiesCompleted/activitiesTotal)*100) : 0;
                                        return {
                                          id: a.id,
                                          nombre: a.name,
                                          fase_actual: a.current_phase,
                                          actividades_completadas: activitiesCompleted,
                                          actividades_totales: activitiesTotal,
                                          avance_porcentaje: pct,
                                          estado: a.status,
                                          inicio: a.start_date,
                                          fin: a.end_date,
                                        };
                                    });
                                    const header = Object.keys(rows[0] || {}).join(',');
                                    const mainSection = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
                                    // Phase log detail section
                                    const logRows = subset.flatMap(a => (a.phase_log||[]).map(entry => ({
                                        audit_id: a.id,
                                        nombre: a.name,
                                        from: entry.from || '',
                                        to: entry.to || '',
                                        timestamp: entry.ts,
                                        actor: entry.actor || '',
                                    })));
                                    let logSection = '';
                                    if(logRows.length){
                                        const logHeader = Object.keys(logRows[0]).join(',');
                                        logSection = '\n\nFase Log Detallado\n' + [logHeader, ...logRows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
                                    }
                                    const csv = mainSection + logSection;
                                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const aLink = document.createElement('a');
                                    aLink.href = url;
                                    aLink.download = `reporte_fases_auditorias_${phaseFilter===null?'todas':phaseFilter}_${new Date().toISOString().slice(0,10)}.csv`;
                                    document.body.appendChild(aLink);
                                    aLink.click();
                                    document.body.removeChild(aLink);
                                } catch(e){
                                    console.error(e);
                                    alert('No se pudo exportar el reporte');
                                } finally {
                                    setExporting(false);
                                }
                            }}
                            disabled={exporting || audits.length===0}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-brand-secondary border border-brand-secondary/40 rounded-md hover:bg-brand-secondary hover:text-white transition disabled:opacity-40"
                        >
                            {exporting ? 'Exportando...' : 'Exportar Avance Fases'}
                        </button>
                        <button
                            type="button"
                            onClick={async ()=>{
                                setCheckingSchema(true); setShowHealth(true);
                                try { 
                                    const res = await checkAuditsTable(); setSchemaHealth(res);
                                    const others = await checkMultipleTables(['audit_findings','audit_tasks','tasks']); setRelatedHealth(others);
                                } catch { /* ignore */ } finally { setCheckingSchema(false); }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100 transition"
                        >{checkingSchema ? 'Verificando...' : 'Verificar esquema'}</button>
                    </div>
                    {showHealth && (
                        <div className="mt-4 text-xs border rounded-md p-3 bg-white/70 space-y-2 max-w-xl">
                            {!schemaHealth && <p className="text-slate-500">Iniciando verificación...</p>}
                            {schemaHealth && (
                                <div className="space-y-3">
                                    {[schemaHealth, ...relatedHealth].map(h => (
                                        <div key={h.table} className="border border-slate-200 rounded p-2 bg-white/60">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`h-2 w-2 rounded-full ${h.ok ? 'bg-green-500':'bg-red-500'}`}></span>
                                                <span className="font-semibold">{h.table}</span>
                                            </div>
                                            {h.ok ? <p className="text-green-700">OK ({h.columns.length} columnas)</p> : (
                                                <div className="space-y-1">
                                                    {h.missing.length>0 && <p className="text-red-600">Faltan: {h.missing.join(', ')}</p>}
                                                    {h.extra.length>0 && <p className="text-amber-600">Extra: {h.extra.join(', ')}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button type="button" className="text-[10px] text-slate-500 hover:underline" onClick={()=>setShowHealth(false)}>Ocultar</button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-brand-primary rounded-lg hover:bg-brand-secondary transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                >
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>Planificar Auditoría</span>
                </button>
            </div>

            {loading && (
                <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            )}

            {!loading && error && (
                 <div className="p-8 m-4 bg-red-50 border border-red-200 rounded-lg text-center animate-fade-in">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-status-danger" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-red-800">Error al Cargar Auditorías</h3>
                    <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                        {error}
                    </p>
                </div>
            )}
            
            {!loading && !error && audits.length === 0 && (
                <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-slate-300">
                    <ShieldCheckIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-lg font-medium text-slate-800">No hay auditorías planificadas</h3>
                    <p className="mt-1 text-sm text-slate-500">Haga clic en "Planificar Auditoría" para crear la primera.</p>
                </div>
            )}

            {!loading && !error && audits.length > 0 && (
                <div className="space-y-6">
                    {filteredAudits
                        .slice((page-1)*pageSize, page*pageSize)
                        .map(audit => (
                            <AuditCard 
                                key={audit.id} 
                                audit={audit}
                                onUpdateAudit={handleUpdateAuditInList}
                            />
                        ))}
                    <div className="pt-4 flex justify-between items-center text-xs text-slate-500">
                        <div>
                            Página {page} de {Math.max(1, Math.ceil(filteredAudits.length / pageSize))}
                        </div>
                        <div className="flex gap-2">
                            <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100">Anterior</button>
                            <button disabled={page >= Math.ceil(filteredAudits.length / pageSize)} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100">Siguiente</button>
                        </div>
                    </div>
                </div>
            )}

            <CreateAuditModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={fetchAudits} // Refetch all audits after a new one is created
                auditors={auditors}
                institutionProfile={institutionProfile}
            />
        </div>
    );
};

export default AuditoriasView;