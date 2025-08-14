
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, ScopeLevel, Database, InstitutionProfileRow } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import SparklesIcon from './icons/SparklesIcon';
import { getAuditPlanSuggestion } from '../services/geminiService';
import EnhancedSelect, { EnhancedSelectOption } from './EnhancedSelect';

interface CreateAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newAuditId: number) => void;
    auditors: Profile[];
    institutionProfile: InstitutionProfileRow | null;
}

const CreateAuditModal: React.FC<CreateAuditModalProps> = ({ isOpen, onClose, onSave, auditors, institutionProfile }) => {
    const [name, setName] = useState('');
    const [auditorId, setAuditorId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [scopeLevel, setScopeLevel] = useState<ScopeLevel | 'General'>('General');
    const [scopeEntity, setScopeEntity] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    
    const [aiDescription, setAiDescription] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ name: string; scope_level: string; scope_entity: string; raw?: any } | null>(null);
    const [aiObjective, setAiObjective] = useState('');
    const [aiHistory, setAiHistory] = useState<Array<{ id: string; name: string; scope_level: string; scope_entity: string }>>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [autoAcceptName, setAutoAcceptName] = useState(true);

    const dynamicScopeOptions = useMemo(() => {
        if (!institutionProfile) {
            return { 'Campus': [], 'Nivel Educativo': [], 'Facultad/Escuela': [] };
        }
        const faculties = [...new Set(institutionProfile.academic_programs.map(p => p.faculty).filter(Boolean))];
        return {
            'Campus': institutionProfile.locations.map(l => l.name),
            'Nivel Educativo': institutionProfile.educational_levels,
            'Facultad/Escuela': faculties,
        };
    }, [institutionProfile]);


    useEffect(() => {
        if (isOpen) {
            setName('');
            setAuditorId(null);
            setStartDate('');
            setEndDate('');
            setScopeLevel('General');
            setScopeEntity('');
            setError(null);
            setIsSaving(false);
            setAiDescription('');
            setIsAiLoading(false);
            setAiError(null);
            setSelectedProjectId(null);
            setAiSuggestion(null);
            setAiHistory([]);
            setShowHistory(false);
            setAutoAcceptName(true);
            setAiObjective('');
        }
    }, [isOpen]);

    useEffect(() => {
        // Load accessible projects for selector
        const loadProjects = async () => {
            const { data, error } = await supabase.from('projects' as any).select('id, name').order('created_at', { ascending: false });
            if (!error && data) {
                setProjects(data as { id: string; name: string }[]);
            }
        };
        if (isOpen) loadProjects();
    }, [isOpen]);
    // Precompute select options (safe even if modal cerrado)
    const auditorOptions: EnhancedSelectOption[] = useMemo(()=> auditors.map(a=>({ value: a.id, label: a.full_name })), [auditors]);
    const projectOptions: EnhancedSelectOption[] = useMemo(()=> projects.map(p=>({ value: p.id, label: p.name })), [projects]);
    const scopeLevelOptions: EnhancedSelectOption[] = useMemo(()=> [
        { value: 'General', label: 'General (Toda la Institución)' },
        ...Object.keys(dynamicScopeOptions).map(l => ({ value: l, label: l }))
    ], [dynamicScopeOptions]);
    const scopeEntityOptions: EnhancedSelectOption[] = useMemo(()=> scopeLevel==='General' ? [] : (dynamicScopeOptions[scopeLevel as keyof typeof dynamicScopeOptions] || []).map(e => ({ value: e, label: e })), [scopeLevel, dynamicScopeOptions]);

    if (!isOpen) return null;

    const handleGetAiSuggestions = async (regenerate = false) => {
        setIsAiLoading(true);
        setAiError(null);
        setError(null);
        try {
            const suggestion = await getAuditPlanSuggestion(aiDescription);
            const enriched = { ...suggestion, raw: suggestion };
            setAiSuggestion(enriched);
            setAiHistory(prev => [{ id: crypto.randomUUID(), name: suggestion.name, scope_level: suggestion.scope_level, scope_entity: suggestion.scope_entity }, ...prev].slice(0,10));
            if (autoAcceptName || !regenerate) {
                setName(suggestion.name);
            }
            const validScopeLevel = [...Object.keys(dynamicScopeOptions), 'General'].includes(suggestion.scope_level)
                ? suggestion.scope_level
                : 'General';
            setScopeLevel(validScopeLevel as any);
            if (validScopeLevel !== 'General' && suggestion.scope_entity) {
                const entityExists = (dynamicScopeOptions[validScopeLevel as keyof typeof dynamicScopeOptions] || []).some(
                    opt => opt.toLowerCase() === suggestion.scope_entity.toLowerCase()
                );
                setScopeEntity(entityExists ? suggestion.scope_entity : '');
            } else {
                setScopeEntity('');
            }
        } catch (error: any) {
            setAiError(error.message || 'No se pudieron obtener sugerencias.');
        } finally {
            setIsAiLoading(false);
        }
    };


    const isNameInvalid = !name.trim();
    const isAuditorInvalid = !auditorId;
    const isStartInvalid = !startDate;
    const isEndInvalid = !endDate || (startDate && endDate && endDate < startDate);

    const handleSave = async () => {
        setError(null);
        if (isNameInvalid || isAuditorInvalid || isStartInvalid || isEndInvalid) {
            setError('Por favor, complete todos los campos obligatorios.');
            return;
        }
        if (scopeLevel !== 'General' && !scopeEntity) {
            setError(`Por favor, seleccione una entidad para el nivel de ámbito "${scopeLevel}".`);
            return;
        }
        setIsSaving(true);
        
        const defaultPhaseActivities = {
            planificacion: { activities: [
                { key: 'definir_objetivos_alcance', title: 'Definición de objetivos y alcance', completed: false },
                { key: 'recopilar_info_previa', title: 'Recopilación y análisis de información previa', completed: false },
                { key: 'asignar_tareas_responsables', title: 'Asignación de tareas y responsabilidades', completed: false },
                { key: 'valoracion_contexto_hipotesis', title: 'Valoración de contexto e hipótesis', completed: false },
                { key: 'cronograma_actividades', title: 'Elaboración del cronograma y carta', completed: false }
            ]},
            ejecucion: { activities: [
                { key: 'visita_institucion', title: 'Visita a la institución', completed: false },
                { key: 'entrevistas', title: 'Entrevistas y conversatorios', completed: false },
                { key: 'revision_documentos', title: 'Revisión de documentos', completed: false },
                { key: 'observacion_aulas', title: 'Observación de aulas', completed: false },
                { key: 'registro_hallazgos', title: 'Registro de hallazgos', completed: false }
            ]},
            evaluacion: { activities: [
                { key: 'analisis_resultados', title: 'Análisis de resultados y evidencias', completed: false },
                { key: 'identificacion_fortalezas_mejoras', title: 'Identificación de fortalezas y mejoras', completed: false },
                { key: 'redaccion_informe', title: 'Redacción del informe', completed: false },
                { key: 'emision_informe', title: 'Emisión del informe', completed: false }
            ]},
            seguimiento: { activities: [
                { key: 'retroalimentacion', title: 'Retroalimentación a la institución', completed: false },
                { key: 'planes_accion', title: 'Planes de acción', completed: false },
                { key: 'monitoreo_continuo', title: 'Monitoreo continuo', completed: false },
                { key: 'difusion_resultados', title: 'Difusión de resultados', completed: false }
            ]},
        };
        const newAuditPayload: Database['public']['Tables']['audits']['Insert'] = {
            name,
            auditor_id: auditorId,
            start_date: startDate,
            end_date: endDate,
            scope_level: scopeLevel,
            scope_entity: scopeLevel === 'General' ? null : scopeEntity,
            status: 'Planificada',
            project_id: selectedProjectId || null,
            ai_description: aiDescription || null,
            ai_raw_suggestion: aiSuggestion?.raw || null,
            current_phase: 'planificacion',
            phase_activities: defaultPhaseActivities as any,
        };

        const { data, error: insertError } = await supabase
            .from('audits')
            .insert([newAuditPayload] as any)
            .select('id')
            .single();

        setIsSaving(false);
        if (insertError) {
            setError(`Error al guardar: ${insertError.message}`);
        } else if (data) {
            onSave(data.id);
            onClose();
        }
    };
    
    const inputBaseStyles = "w-full p-2 bg-white border border-slate-300 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-colors duration-200";

    // (Option hooks moved above early return)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="bg-slate-50 text-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-brand-primary">Planificar Nueva Auditoría</h2>
                    <p className="text-sm text-slate-500 mt-1">Defina los parámetros clave para la nueva auditoría.</p>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 space-y-5">
                    <div className="p-4 bg-blue-50 border border-dashed border-blue-200 rounded-lg space-y-3">
                        <label htmlFor="ai-description" className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
                            <SparklesIcon className="w-6 h-6 text-yellow-500" />
                            <span>Definir con IA</span>
                        </label>
                        <p className="text-sm text-slate-600">
                            Describa el propósito de la auditoría y la IA sugerirá los parámetros clave.
                            Ej: "Revisar el cumplimiento de los protocolos de seguridad y protección civil en los laboratorios de química del campus norte."
                        </p>
                        <textarea
                            id="ai-description"
                            value={aiDescription}
                            onChange={e => setAiDescription(e.target.value)}
                            className={`${inputBaseStyles} resize-y min-h-[80px]`}
                            rows={3}
                            placeholder="Escriba aquí la descripción..."
                            disabled={isAiLoading}
                        />
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            <button
                                type="button"
                                onClick={() => handleGetAiSuggestions(false)}
                                disabled={isAiLoading || !aiDescription.trim()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                {isAiLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Generando...</span>
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-4 h-4" />
                                        <span>Obtener Sugerencias</span>
                                    </>
                                )}
                            </button>
                            {aiSuggestion && (
                                <button
                                    type="button"
                                    onClick={() => handleGetAiSuggestions(true)}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-brand-secondary border border-brand-secondary/40 hover:bg-brand-secondary hover:text-white transition-all"
                                >Re-generar</button>
                            )}
                            <label className="flex items-center gap-1 text-[11px] text-slate-600 select-none">
                                <input type="checkbox" className="h-3 w-3" checked={autoAcceptName} onChange={e => setAutoAcceptName(e.target.checked)} />
                                Aplicar nombre automáticamente
                            </label>
                        </div>
                        {aiError && <p className="text-xs text-red-600 mt-1 text-center">{aiError}</p>}
                        {aiSuggestion && !aiError && (
                            <div className="mt-2 border border-blue-200 bg-white rounded-md p-3 space-y-2 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-semibold text-blue-700">Sugerencia Generada</h5>
                                    <button
                                        type="button"
                                        onClick={() => setAiSuggestion(null)}
                                        className="text-[11px] text-slate-500 hover:text-slate-700"
                                    >Ocultar</button>
                                </div>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    <li><strong>Nombre:</strong> {aiSuggestion.name}</li>
                                    <li><strong>Nivel sugerido:</strong> {aiSuggestion.scope_level}</li>
                                    <li><strong>Entidad sugerida:</strong> {aiSuggestion.scope_entity || '—'}</li>
                                </ul>
                                {scopeLevel !== 'General' && scopeEntity === '' && aiSuggestion.scope_entity && (
                                    <div className="text-[11px] text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-1">
                                        La entidad sugerida "{aiSuggestion.scope_entity}" no coincide exactamente con las opciones disponibles para {scopeLevel}. Selecciónela manualmente si aplica.
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-500">Los campos arriba (Nombre / Nivel / Entidad) se ajustaron con la última sugerencia. Puedes editar o regenerar.</p>
                                {aiHistory.length > 1 && (
                                    <div className="pt-2 border-t border-slate-200">
                                        <button type="button" onClick={() => setShowHistory(s => !s)} className="text-[11px] text-blue-600 hover:underline">
                                            {showHistory ? 'Ocultar historial' : `Historial (${aiHistory.length})`}
                                        </button>
                                        {showHistory && (
                                            <ul className="mt-2 max-h-32 overflow-y-auto space-y-1 text-[11px] text-slate-600">
                                                {aiHistory.map(h => (
                                                    <li key={h.id}>
                                                        <button type="button" className="hover:underline" onClick={() => { setName(h.name); setScopeLevel(h.scope_level as any); setScopeEntity(h.scope_entity); }}>
                                                            {h.name} <span className="text-slate-400">[{h.scope_level}{h.scope_entity?': '+h.scope_entity:''}]</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="audit-name" className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                            <span>Nombre de la Auditoría</span>
                            {aiSuggestion && (
                                <button type="button" onClick={() => setName(aiSuggestion.name)} className="text-[11px] text-blue-600 hover:underline">Aplicar sugerencia</button>
                            )}
                        </label>
                        <input id="audit-name" type="text" value={name} onChange={e => setName(e.target.value)} className={inputBaseStyles + (isNameInvalid ? ' border-red-400 focus:ring-red-300':'')} placeholder="Ej: Auditoría de Seguridad Laboral Q3 2024" />
                        {isNameInvalid && <p className="text-[11px] text-red-600 mt-0.5">Requerido</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                            <span>Objetivo (opcional)</span>
                            <span className="text-[10px] text-slate-400">No se guarda aún</span>
                        </label>
                        <textarea value={aiObjective} onChange={e => setAiObjective(e.target.value)} rows={2} className={`${inputBaseStyles} resize-y`} placeholder="Defina el objetivo o alcance detallado (puede basarse en la descripción inicial)." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Auditor Asignado</label>
                            <div className={isAuditorInvalid ? 'rounded-md ring-1 ring-red-300 ring-offset-0 p-0.5 -m-0.5':'p-0'}>
                                <EnhancedSelect
                                    value={auditorId}
                                    onChange={v=> setAuditorId(v)}
                                    options={auditorOptions}
                                    placeholder="Seleccione un auditor..."
                                    clearable
                                    searchable
                                    aria-label="Auditor asignado"
                                />
                            </div>
                            {isAuditorInvalid && <p className="text-[11px] text-red-600 mt-0.5">Requerido</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Proyecto (opcional)</label>
                            <EnhancedSelect
                                value={selectedProjectId}
                                onChange={v=> setSelectedProjectId(v)}
                                options={projectOptions}
                                placeholder="Sin proyecto"
                                clearable
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="space-y-1.5">
                            <label htmlFor="start-date" className="text-sm font-semibold text-slate-700">Fecha de Inicio</label>
                            <div className="relative">
                                <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputBaseStyles} pr-10 ${isStartInvalid?'border-red-400 focus:ring-red-300':''}`} />
                                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                                {isStartInvalid && <p className="text-[10px] text-red-600 mt-1">Requerido</p>}
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label htmlFor="end-date" className="text-sm font-semibold text-slate-700">Fecha de Fin</label>
                            <div className="relative">
                                <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputBaseStyles} pr-10 ${isEndInvalid?'border-red-400 focus:ring-red-300':''}`} />
                                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                                {isEndInvalid && <p className="text-[10px] text-red-600 mt-1">{!endDate ? 'Requerido' : 'Debe ser >= fecha inicio'}</p>}
                            </div>
                         </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Ámbito de Aplicación</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-white rounded-md border border-slate-200">
                             <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">Nivel</label>
                                <EnhancedSelect
                                    value={scopeLevel}
                                    onChange={v=> { setScopeLevel((v as any) || 'General'); setScopeEntity(''); }}
                                    options={scopeLevelOptions}
                                    placeholder="Seleccionar nivel"
                                    clearable
                                />
                            </div>
                            {scopeLevel !== 'General' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">{scopeLevel} Específico</label>
                                    <EnhancedSelect
                                        value={scopeEntity || null}
                                        onChange={v=> setScopeEntity(v || '')}
                                        options={scopeEntityOptions}
                                        placeholder="Seleccione una entidad..."
                                        clearable
                                        searchable={scopeEntityOptions.length > 8}
                                        disabled={scopeEntityOptions.length === 0}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 my-2 text-sm text-center text-red-800 bg-red-100 rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white/70 backdrop-blur-sm border-t border-slate-200 flex justify-end items-center gap-4">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed">
                        {isSaving ? 'Guardando...' : 'Guardar Auditoría'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateAuditModal;