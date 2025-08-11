
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, ScopeLevel, Database, InstitutionProfileRow } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import SparklesIcon from './icons/SparklesIcon';
import { getAuditPlanSuggestion } from '../services/geminiService';

interface CreateAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newAuditId: number) => void;
    auditors: Profile[];
    institutionProfile: InstitutionProfileRow | null;
}

const CreateAuditModal: React.FC<CreateAuditModalProps> = ({ isOpen, onClose, onSave, auditors, institutionProfile }) => {
    const [name, setName] = useState('');
    const [auditorId, setAuditorId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [scopeLevel, setScopeLevel] = useState<ScopeLevel | 'General'>('General');
    const [scopeEntity, setScopeEntity] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [aiDescription, setAiDescription] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

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
            setAuditorId('');
            setStartDate('');
            setEndDate('');
            setScopeLevel('General');
            setScopeEntity('');
            setError(null);
            setIsSaving(false);
            setAiDescription('');
            setIsAiLoading(false);
            setAiError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGetAiSuggestions = async () => {
        setIsAiLoading(true);
        setAiError(null);
        setError(null);
        try {
            const suggestion = await getAuditPlanSuggestion(aiDescription);
            
            setName(suggestion.name);
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


    const handleSave = async () => {
        setError(null);
        if (!name || !auditorId || !startDate || !endDate) {
            setError('Por favor, complete todos los campos obligatorios.');
            return;
        }
        if (scopeLevel !== 'General' && !scopeEntity) {
            setError(`Por favor, seleccione una entidad para el nivel de ámbito "${scopeLevel}".`);
            return;
        }
        setIsSaving(true);
        
        const newAuditPayload: Database['public']['Tables']['audits']['Insert'] = {
            name,
            auditor_id: auditorId,
            start_date: startDate,
            end_date: endDate,
            scope_level: scopeLevel,
            scope_entity: scopeLevel === 'General' ? null : scopeEntity,
            status: 'Planificada',
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
                        <button
                            onClick={handleGetAiSuggestions}
                            disabled={isAiLoading || !aiDescription.trim()}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
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
                        {aiError && <p className="text-xs text-red-600 mt-1 text-center">{aiError}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="audit-name" className="text-sm font-semibold text-slate-700">Nombre de la Auditoría</label>
                        <input id="audit-name" type="text" value={name} onChange={e => setName(e.target.value)} className={inputBaseStyles} placeholder="Ej: Auditoría de Seguridad Laboral Q3 2024" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="space-y-1.5">
                            <label htmlFor="auditor-id" className="text-sm font-semibold text-slate-700">Auditor Asignado</label>
                            <select id="auditor-id" value={auditorId} onChange={e => setAuditorId(e.target.value)} className={`${inputBaseStyles} appearance-none`}>
                                <option value="" disabled>Seleccione un auditor...</option>
                                {auditors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="space-y-1.5">
                            <label htmlFor="start-date" className="text-sm font-semibold text-slate-700">Fecha de Inicio</label>
                            <div className="relative">
                                <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputBaseStyles} pr-10`} />
                                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label htmlFor="end-date" className="text-sm font-semibold text-slate-700">Fecha de Fin</label>
                            <div className="relative">
                                <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputBaseStyles} pr-10`} />
                                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                            </div>
                         </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Ámbito de Aplicación</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-white rounded-md border border-slate-200">
                             <div className="space-y-1.5">
                                <label htmlFor="scope-level" className="text-xs font-medium text-slate-500">Nivel</label>
                                <select id="scope-level" value={scopeLevel} onChange={e => { setScopeLevel(e.target.value as any); setScopeEntity(''); }} className={`${inputBaseStyles} appearance-none`}>
                                    <option value="General">General (Toda la Institución)</option>
                                    {Object.keys(dynamicScopeOptions).map(level => <option key={level} value={level}>{level}</option>)}
                                </select>
                            </div>
                             {scopeLevel !== 'General' && (
                                 <div className="space-y-1.5">
                                    <label htmlFor="scope-entity" className="text-xs font-medium text-slate-500">{scopeLevel} Específico</label>
                                    <select id="scope-entity" value={scopeEntity} onChange={e => setScopeEntity(e.target.value)} className={`${inputBaseStyles} appearance-none`}
                                    disabled={dynamicScopeOptions[scopeLevel as keyof typeof dynamicScopeOptions]?.length === 0}>
                                        <option value="" disabled>Seleccione una entidad...</option>
                                        {(dynamicScopeOptions[scopeLevel as keyof typeof dynamicScopeOptions] || []).map(entity => <option key={entity} value={entity}>{entity}</option>)}
                                    </select>
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