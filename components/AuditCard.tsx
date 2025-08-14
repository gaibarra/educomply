import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Audit, AuditFinding, Database, AuditPhaseActivity, AuditPhaseKey, AuditPhasesState } from '../types';
import FindingItem from './FindingItem';
import { useToast } from './ToastProvider';
import PlusCircleIcon from './icons/PlusCircleIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import CalendarIcon from './icons/CalendarIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import FlagIcon from './icons/FlagIcon';

interface AuditCardProps {
    audit: Audit;
    onUpdateAudit: (updatedAudit: Audit) => void;
}

const AuditCard: React.FC<AuditCardProps> = ({ audit, onUpdateAudit }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showPhasePanel, setShowPhasePanel] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [phaseTooltipOpen, setPhaseTooltipOpen] = useState(false);
    const [savingPhase, setSavingPhase] = useState(false);
    const { addToast } = useToast();
    const phaseOrder: AuditPhaseKey[] = ['planificacion','ejecucion','evaluacion','seguimiento'];
    const nextPhase = (p: AuditPhaseKey | null | undefined) => {
        if(!p) return null;
        const idx = phaseOrder.indexOf(p);
        return idx >=0 && idx < phaseOrder.length-1 ? phaseOrder[idx+1] : null;
    };
    const prevPhase = (p: AuditPhaseKey | null | undefined) => {
        if(!p) return null;
        const idx = phaseOrder.indexOf(p);
        return idx > 0 ? phaseOrder[idx-1] : null;
    };

    const pushNotification = (type:'success'|'info'|'error', message:string) => addToast(type, message);

    const handleAddFinding = async () => {
        const newFindingPayload: Database['public']['Tables']['audit_findings']['Insert'] = {
            audit_id: audit.id,
            description: '',
            recommendation: '',
            severity: 'Menor',
            status: 'Abierto',
            related_task_id: null,
        };
        const { data, error } = await supabase
            .from('audit_findings')
            .insert([newFindingPayload] as any)
            .select()
            .single();

        if (error) {
            console.error("Error creating finding:", error);
            alert(`Error: ${error.message}`);
            return;
        }
        if (data) {
            onUpdateAudit({ ...audit, findings: [...audit.findings, data as any] });
            setIsExpanded(true);
        }
    };
    
    const handleUpdateFinding = (updatedFinding: AuditFinding) => {
        const updatedFindings = audit.findings.map(f => f.id === updatedFinding.id ? updatedFinding : f);
        onUpdateAudit({ ...audit, findings: updatedFindings });
    };

    const handleDeleteFinding = async (findingId: number) => {
        if (!confirm('¿Está seguro de que desea eliminar este hallazgo? Esta acción no se puede deshacer.')) return;

        const { error } = await supabase.from('audit_findings').delete().eq('id', findingId);
        if (error) {
            console.error("Error deleting finding:", error);
            alert(`Error: ${error.message}`);
            return;
        }
        const updatedFindings = audit.findings.filter(f => f.id !== findingId);
        onUpdateAudit({ ...audit, findings: updatedFindings });
    };

    const closedFindings = audit.findings.filter(f => f.status === 'Cerrado').length;
    const totalFindings = audit.findings.length;
    const progress = totalFindings > 0 ? (closedFindings / totalFindings) * 100 : 0;
    const currentPhaseKey = audit.current_phase;
    const phaseActivities: AuditPhaseActivity[] | undefined = currentPhaseKey && audit.phase_activities ? (audit.phase_activities as any)[currentPhaseKey]?.activities : undefined;
    const phaseCompleted = phaseActivities ? phaseActivities.filter(a => a.completed).length : 0;
    const phaseTotal = phaseActivities ? phaseActivities.length : 0;
    const phasePct = phaseTotal > 0 ? (phaseCompleted / phaseTotal) * 100 : 0;
    
    const statusClasses = {
        'Planificada': 'bg-slate-100 text-slate-800',
        'En Progreso': 'bg-blue-100 text-blue-800',
        'Completada': 'bg-green-100 text-green-800',
        'Cancelada': 'bg-gray-100 text-gray-500',
    };

    return (
        <div className="bg-white rounded-xl shadow-lg transition-all duration-300">
            <div className="p-5 border-b border-slate-200 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusClasses[audit.status]}`}>
                                {audit.status}
                            </span>
                            <div className="flex items-center gap-1.5 text-sm text-brand-primary font-medium bg-brand-secondary/10 px-2 py-0.5 rounded-full">
                                <BuildingOfficeIcon className="w-4 h-4"/>
                                <span>{audit.scope_level}: {audit.scope_entity || 'Global'}</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mt-2">{audit.name}</h3>
                    </div>
                    <button className="text-slate-400 hover:text-brand-primary p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
                 <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500 mt-3">
                    <div className="flex items-center gap-1.5">
                        <UserCircleIcon className="w-4 h-4"/>
                        <span>Auditor: <strong>{audit.auditor?.full_name || 'No asignado'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4"/>
                        <span>{new Date(audit.start_date).toLocaleDateString('es-MX')} - {new Date(audit.end_date).toLocaleDateString('es-MX')}</span>
                    </div>
                </div>

                <div className="mt-4 space-y-4">
                    {/* Global toasts handled by provider */}
                    {currentPhaseKey && (
                                                <div className="relative">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-slate-600 capitalize flex items-center gap-2">
                                    Fase: {currentPhaseKey.replace('planificacion','Planificación').replace('ejecucion','Ejecución').replace('evaluacion','Evaluación').replace('seguimiento','Seguimiento')}
                                    <button
                                        type="button"
                                        onClick={() => setShowPhasePanel(v=>!v)}
                                        className="text-[11px] font-normal text-blue-600 hover:underline"
                                    >{showPhasePanel? 'cerrar' : 'ver actividades'}</button>
                                                                        { (audit.phase_log?.length||0) > 0 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setShowHistoryModal(true)}
                                                                                    className="text-[11px] font-normal text-slate-500 hover:text-slate-700 hover:underline"
                                                                                >Historial</button>
                                                                        )}
                                </span>
                                <span className="text-sm font-bold text-brand-secondary">{phaseCompleted} / {phaseTotal}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPhaseTooltipOpen(o=>!o)}
                                className="group w-full bg-slate-200 rounded-full h-3 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                                aria-label="Ver progreso detallado de actividades"
                            >
                                <div className="bg-gradient-to-r from-brand-primary to-brand-secondary h-full rounded-full transition-all duration-500" style={{ width: `${phasePct}%` }}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-semibold text-slate-700/70 group-hover:text-slate-800">{Math.round(phasePct)}%</span>
                                </div>
                            </button>
                            {phaseTooltipOpen && phaseActivities && (
                                <div className="absolute z-20 mt-2 w-80 bg-white p-4 rounded-lg shadow-xl border border-slate-200 animate-fade-in">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Actividades ({phaseCompleted}/{phaseTotal})</h5>
                                        <button className="text-slate-400 hover:text-slate-600" onClick={()=>setPhaseTooltipOpen(false)}>&times;</button>
                                    </div>
                                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                        {phaseActivities.map(a => (
                                            <li key={a.key} className="text-[11px] flex items-start gap-1">
                                                <span className={`mt-0.5 inline-block h-2 w-2 rounded-full ${a.completed? 'bg-green-500':'bg-slate-300'}`}></span>
                                                <span className="leading-tight">{a.title}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-3 flex justify-end">
                                        <button onClick={()=>{setShowPhasePanel(true);setPhaseTooltipOpen(false);}} className="text-[11px] text-blue-600 hover:underline">Editar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-600">Hallazgos Cerrados</span>
                        <span className="text-sm font-bold text-brand-secondary">{closedFindings} de {totalFindings}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div className="bg-brand-secondary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    {showPhasePanel && (
                        <PhaseActivitiesEditor
                            audit={audit}
                            currentPhaseKey={currentPhaseKey as AuditPhaseKey}
                            activities={phaseActivities || []}
                            onClose={()=>setShowPhasePanel(false)}
                            onUpdateAudit={onUpdateAudit}
                            saving={savingPhase}
                            setSaving={setSavingPhase}
                            advancePhase={(newPhase)=>{
                                onUpdateAudit({...audit, current_phase: newPhase});
                            }}
                            nextPhase={nextPhase}
                            prevPhase={prevPhase}
                            notify={pushNotification}
                        />
                    )}
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-5 bg-slate-50/50 animate-fade-in space-y-5">
                    <div>
                        <h4 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <FlagIcon className="w-5 h-5 text-brand-secondary"/>
                            Hallazgos
                        </h4>
                         <div className="space-y-4">
                            {audit.findings.length > 0 ? (
                                audit.findings.map(finding => (
                                    <FindingItem 
                                        key={finding.id} 
                                        finding={finding}
                                        onUpdate={handleUpdateFinding}
                                        onDelete={handleDeleteFinding}
                                    />
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">No se han registrado hallazgos para esta auditoría.</p>
                            )}
                        </div>
                         <div className="mt-4 pt-4 border-t border-slate-200/80">
                            <button 
                                onClick={handleAddFinding}
                                className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors"
                            >
                                <PlusCircleIcon className="w-5 h-5"/>
                                Agregar Hallazgo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showHistoryModal && (
                <PhaseHistoryModal
                    title={audit.name}
                    phaseLog={audit.phase_log || []}
                    onClose={()=>setShowHistoryModal(false)}
                />
            )}
        </div>
    );
};

export default AuditCard;

// Render history modal outside main card when needed
// (Attach at end of file root export pattern not required since used inside component conditional)
// Integrate into main component render block by conditional below

// History Modal
const PhaseHistoryModal: React.FC<{ onClose: ()=>void; phaseLog: any[]; title: string }> = ({ onClose, phaseLog, title }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white rounded-xl shadow-2xl border border-slate-200 animate-fade-in">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                    <h4 className="text-base font-bold text-slate-700">Historial de Fases – {title}</h4>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
                </div>
                <div className="p-5 overflow-y-auto">
                    {phaseLog.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin registros.</p>
                    ) : (
                        <ul className="space-y-3 text-sm">
                            {phaseLog.map((entry, idx) => (
                                <li key={idx} className={`p-3 rounded-md border ${entry.forced? 'border-red-300 bg-red-50':'border-slate-200 bg-slate-50'} flex flex-col gap-1`}>
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <span className="font-medium text-slate-700 flex items-center gap-2">
                                            {formatPhase(entry.from)} → {formatPhase(entry.to)}
                                            {entry.forced && <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white">Forzado</span>}
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-mono">{new Date(entry.ts).toLocaleString('es-MX')}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">Actor: {entry.actor || '—'}</div>
                                    {entry.reason && (
                                        <div className="text-[11px] text-red-700 flex items-start gap-1">
                                            <span className="font-semibold">Motivo:</span>
                                            <span className="flex-1 break-words">{entry.reason}</span>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-100 text-slate-600">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

const formatPhase = (p: string | null) => {
    if(!p) return '—';
    return p.replace('planificacion','Planificación').replace('ejecucion','Ejecución').replace('evaluacion','Evaluación').replace('seguimiento','Seguimiento');
};

// --- Internal component for editing phase activities ---
interface PhaseActivitiesEditorProps {
    audit: Audit;
    currentPhaseKey: AuditPhaseKey;
    activities: AuditPhaseActivity[];
    onClose: () => void;
    onUpdateAudit: (updated: Audit) => void;
    saving: boolean;
    setSaving: (v: boolean) => void;
    advancePhase: (p: AuditPhaseKey | null) => void;
    nextPhase: (p: AuditPhaseKey | null | undefined) => AuditPhaseKey | null;
    prevPhase: (p: AuditPhaseKey | null | undefined) => AuditPhaseKey | null;
    notify: (type:'success'|'info'|'error', message:string) => void;
}

const PhaseActivitiesEditor: React.FC<PhaseActivitiesEditorProps> = ({ audit, currentPhaseKey, activities, onClose, onUpdateAudit, saving, setSaving, advancePhase, nextPhase, prevPhase, notify }) => {
    const [localActivities, setLocalActivities] = useState<AuditPhaseActivity[]>(activities);
    const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
    const [lastBlockedReason, setLastBlockedReason] = useState<string | null>(null);

    const titleMap: Record<AuditPhaseKey,string> = {
        planificacion: 'Planificación',
        ejecucion: 'Ejecución',
        evaluacion: 'Evaluación / Informes',
        seguimiento: 'Seguimiento y Mejora'
    };

    const allComplete = localActivities.length>0 && localActivities.every(a=>a.completed);
    const upcomingPhase = nextPhase(currentPhaseKey);

    const commitUpdate = async (updatedActivities: AuditPhaseActivity[], autoAdvance: boolean = true) => {
        setSaving(true);
        try {
            // Merge back into full phases object
            const phases: AuditPhasesState = audit.phase_activities ? { ...(audit.phase_activities as any) } : {};
            if(!phases[currentPhaseKey]) phases[currentPhaseKey] = { activities: [] } as any;
            phases[currentPhaseKey] = { activities: updatedActivities } as any;
            let newPhase: AuditPhaseKey | null | undefined = audit.current_phase as any;
            let newStatus = audit.status;
            if(autoAdvance && updatedActivities.length>0 && updatedActivities.every(a=>a.completed)) {
                const np = nextPhase(currentPhaseKey);
                if(np) newPhase = np;
                if(np && np !== 'planificacion') newStatus = 'En Progreso';
                if(!np) { // no next phase, last completed
                    newStatus = 'Completada';
                }
            }
            // Prepare log entry if phase changes
            const logEntry = newPhase !== audit.current_phase ? [{ ts: new Date().toISOString(), from: audit.current_phase || null, to: newPhase || null, actor: audit.auditor_id }] : [];
            const mergedLog = logEntry.length ? [ ...(audit.phase_log || []), ...logEntry ] : (audit.phase_log || []);
            const updatePayload: any = { phase_activities: phases as any, current_phase: newPhase, phase_log: mergedLog };
            if(newStatus !== audit.status) updatePayload.status = newStatus;
            const { data, error } = await supabase.from('audits').update(updatePayload).eq('id', audit.id).select().single();
            if(error) throw error;
            if(data){
                onUpdateAudit({ ...(data as any), auditor: audit.auditor, findings: audit.findings });
                if(newPhase !== audit.current_phase && newPhase){
                    notify('success', `Avanzó automáticamente a fase ${titleMap[newPhase]}`);
                }
                if(updatePayload.status === 'Completada') {
                    notify('success', 'Auditoría marcada como Completada');
                }
                if(!newPhase && updatePayload.status === 'Completada') notify('success','Fases completadas');
            }
            else notify('error','No se recibieron datos al guardar');
        } catch(e){
            console.error('Error actualizando actividades de fase', e);
            notify('error','No se pudo guardar cambios de fase');
        } finally {
            setSaving(false);
        }
    };

    const toggleCompleted = (key: string) => {
        setLocalActivities(prev => prev.map(a => a.key === key ? { ...a, completed: !a.completed } : a));
    };
    const updateNotes = (key: string, notes: string) => {
        setLocalActivities(prev => prev.map(a => a.key === key ? { ...a, notes } : a));
    };

    const handleSave = () => {
        commitUpdate(localActivities, true);
    };

    const handleAdvanceNow = () => {
        // Manual advance: do not require all complete; mark status transitions
        const np = nextPhase(currentPhaseKey);
        if(!np){
            notify('info','No hay fase siguiente');
            return;
        }
        // Date validations
        const today = new Date();
        const start = new Date(audit.start_date);
        const end = new Date(audit.end_date);
        if(np === 'ejecucion' && today < start){
            const msg = 'No puede iniciar Ejecución antes de la fecha de inicio';
            notify('error', msg);
            setLastBlockedReason(msg);
            return;
        }
        if(np === 'evaluacion' && today < end){
            const msg = 'No puede iniciar Evaluación antes de la fecha de fin programada';
            notify('error', msg);
            setLastBlockedReason(msg);
            return;
        }
        if(np === 'seguimiento' && today < end){
            const msg = 'No puede iniciar Seguimiento antes de la fecha de fin';
            notify('error', msg);
            setLastBlockedReason(msg);
            return;
        }
        commitUpdate(localActivities, false).then(()=>{
            const logEntry = { ts: new Date().toISOString(), from: currentPhaseKey || null, to: np, actor: audit.auditor_id };
            supabase.from('audits').update({ current_phase: np, status: np !== 'seguimiento' ? 'En Progreso':'En Progreso', phase_log: [ ...(audit.phase_log||[]), logEntry ] }).eq('id', audit.id).select().single().then(({data,error})=>{
                if(!error && data){
                    onUpdateAudit({ ...(data as any), auditor: audit.auditor, findings: audit.findings });
                    notify('success', `Fase cambiada manualmente a ${titleMap[np]}`);
                    setLastBlockedReason(null);
                } else if(error){
                    notify('error','No se pudo avanzar de fase');
                }
            });
        });
    };

    const handleForceAdvance = () => {
        const np = nextPhase(currentPhaseKey);
        if(!np){
            notify('info','No hay fase siguiente');
            return;
        }
        if(!confirm(`Forzar avance a la fase ${titleMap[np]} ignorando restricciones de fechas?`)) return;
        let reason = prompt('Motivo del avance forzado (requerido):') || '';
        reason = reason.trim();
        if(!reason){
            notify('error','Debe ingresar un motivo para el avance forzado');
            return;
        }
        if(reason.length > 240) reason = reason.slice(0,240);
        setSaving(true);
        commitUpdate(localActivities, false).then(()=>{
            const logEntry = { ts: new Date().toISOString(), from: currentPhaseKey || null, to: np, actor: audit.auditor_id, forced: true, reason };
            supabase.from('audits').update({ current_phase: np, status: np !== 'seguimiento' ? 'En Progreso':'En Progreso', phase_log: [ ...(audit.phase_log||[]), logEntry ] }).eq('id', audit.id).select().single().then(({data,error})=>{
                setSaving(false);
                if(!error && data){
                    onUpdateAudit({ ...(data as any), auditor: audit.auditor, findings: audit.findings });
                    notify('success', `Avance forzado a ${titleMap[np]}`);
                    setLastBlockedReason(null);
                } else if(error){
                    notify('error','No se pudo forzar el avance');
                }
            });
        });
    };

    const handleRevertPhase = () => {
        const pv = prevPhase(currentPhaseKey);
        if(!pv){
            notify('info','Ya está en la primera fase');
            return;
        }
        if(!confirm('¿Revertir a la fase anterior?')) return;
        setSaving(true);
    const logEntry = { ts: new Date().toISOString(), from: currentPhaseKey || null, to: pv, actor: audit.auditor_id };
    supabase.from('audits').update({ current_phase: pv, status: pv==='planificacion' ? 'Planificada' : 'En Progreso', phase_log: [ ...(audit.phase_log||[]), logEntry ] }).eq('id', audit.id).select().single().then(({data,error})=>{
            setSaving(false);
            if(!error && data){
                onUpdateAudit({ ...(data as any), auditor: audit.auditor, findings: audit.findings });
                notify('success', `Revertido a fase ${titleMap[pv]}`);
            } else if(error){
                console.error(error);
                notify('error','No se pudo revertir fase');
            }
        });
    };

    return (
        <div className="mt-4 border border-slate-200 rounded-lg bg-white/60 p-4 space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-sm font-bold text-slate-700">Actividades de la Fase: <span className="text-brand-secondary">{titleMap[currentPhaseKey]}</span></h5>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full ${allComplete? 'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'}`}>{allComplete? 'Completada':'En progreso'}</span>
                    <button onClick={handleSave} disabled={saving} className="px-3 py-1 rounded-md bg-brand-secondary text-white text-[11px] font-semibold hover:bg-brand-primary disabled:opacity-50 disabled:cursor-not-allowed">{saving? 'Guardando…':'Guardar'}</button>
                    <button onClick={onClose} className="px-2 py-1 rounded-md border text-[11px] font-medium text-slate-600 hover:bg-slate-100">Cerrar</button>
                </div>
            </div>
            <ul className="space-y-3">
                {localActivities.map(act => {
                    const expanded = expandedActivity === act.key;
                    const toggleClasses = act.completed ? 'mt-0.5 h-4 w-4 rounded border flex items-center justify-center bg-green-500 border-green-500 text-white' : 'mt-0.5 h-4 w-4 rounded border flex items-center justify-center border-slate-400 text-transparent hover:border-slate-600';
                    const titleClasses = act.completed ? 'text-sm font-medium leading-snug line-through text-slate-400' : 'text-sm font-medium leading-snug text-slate-700';
                    const iconClasses = expanded ? 'h-4 w-4 transition-transform rotate-180' : 'h-4 w-4 transition-transform';
                    const barClasses = act.completed ? 'h-full transition-all bg-green-400' : 'h-full transition-all bg-slate-200';
                    return (
                        <li key={act.key} className="group border border-slate-200 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3 p-3">
                                <button onClick={()=>toggleCompleted(act.key)} className={toggleClasses} aria-label="Marcar completada">
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.414A1 1 0 014.707 8l3.222 3.222 6.657-6.657a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={titleClasses}>{act.title}</p>
                                        <button onClick={()=>setExpandedActivity(expanded? null: act.key)} className="text-slate-400 hover:text-slate-600" aria-label="Notas">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className={iconClasses}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                                        </button>
                                    </div>
                                    {expanded && (
                                        <div className="mt-2 space-y-2">
                                            <textarea
                                                className="w-full text-[12px] p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/40 resize-y bg-slate-50"
                                                placeholder="Notas, evidencia, decisiones…"
                                                value={act.notes || ''}
                                                onChange={e=>updateNotes(act.key, e.target.value)}
                                                rows={3}
                                            />
                                            <div className="flex justify-end">
                                                <button onClick={()=>setExpandedActivity(null)} className="text-[11px] text-slate-500 hover:underline">Cerrar</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="h-1 w-full bg-slate-100">
                                <div className={barClasses} style={{ width: act.completed? '100%':'0%' }}></div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex flex-col gap-1 text-[11px]">
                    <span className="text-slate-500">Auto-avance al completar todas</span>
                    {allComplete && upcomingPhase && <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Avanzará a {titleMap[upcomingPhase]}</span>}
                    {allComplete && !upcomingPhase && audit.status !== 'Completada' && <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-700">Marcará auditoría Completada</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleRevertPhase} disabled={saving || currentPhaseKey==='planificacion'} className="text-[11px] px-3 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40">Revertir</button>
                    {upcomingPhase && (
                        <>
                            <button onClick={handleAdvanceNow} disabled={saving} className="text-[11px] px-3 py-1 rounded-md border border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white transition disabled:opacity-40">Avanzar</button>
                            {lastBlockedReason && (
                                <button onClick={handleForceAdvance} disabled={saving} className="text-[11px] px-3 py-1 rounded-md border border-red-400 text-red-600 hover:bg-red-600 hover:text-white transition disabled:opacity-40">Forzar</button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {lastBlockedReason && (
                <div className="mt-2 text-[11px] text-red-600 flex items-start gap-2">
                    <span className="font-semibold">Bloqueado:</span>
                    <span className="flex-1">{lastBlockedReason}</span>
                </div>
            )}
        </div>
    );
};