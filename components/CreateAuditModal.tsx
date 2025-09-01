import React from 'react';
import AuditDatesSection from './AuditDatesSection';
import AuditScopeSection from './AuditScopeSection';
import { useCreateAuditModalState } from './hooks/useCreateAuditModalState';
import { Profile, InstitutionProfileRow, Database } from '../types';
import EnhancedSelect from './EnhancedSelect';

interface CreateAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newAuditId: string) => void;
    auditors: Profile[];
    institutionProfile: InstitutionProfileRow | null;
}

const CreateAuditModal: React.FC<CreateAuditModalProps> = ({ isOpen, onClose, onSave, auditors, institutionProfile }) => {
    const {
        state,
        setField,
        auditorOptions,
        projectOptions,
        scopeLevelOptions,
        scopeEntityOptions,
        validateFields,
    } = useCreateAuditModalState({ isOpen, auditors, institutionProfile });

    const { 
        name, auditorId, startDate, endDate, scopeLevel, scopeEntity, 
        isSaving, error, validationErrors, selectedProjectId
    } = state;

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!validateFields()) {
            setField('error', 'Por favor, corrija los errores en el formulario.');
            return;
        }
        setField('isSaving', true);

        const newAuditPayload: Omit<Database['public']['Tables']['audits']['Insert'], 'id' | 'created_at'> = {
            name,
            auditor_id: auditorId,
            start_date: startDate,
            end_date: endDate,
            scope_level: scopeLevel,
            scope_entity: scopeLevel === 'General' ? null : scopeEntity,
            status: 'Planificada',
            project_id: selectedProjectId || null,
            ai_description: null,
            ai_raw_suggestion: null,
        };

        try {
            const { data, error: insertError } = await import('../services/supabaseClient').then(({ supabase }) =>
                supabase.from('audits').insert(newAuditPayload).select('id').single()
            );

            if (insertError) throw insertError;

            if (data) {
                // Create empty/default phase activities so the audit is linked to its activities table
                try {
                    const phases = ['planificacion', 'ejecucion', 'evaluacion', 'seguimiento'];
                    const defaultActivities = phases.map((p) => ({
                        audit_id: data.id,
                        phase: p,
                        description: '',
                        completed: false,
                        notes: null,
                    }));
                    const { error: actErr } = await import('../services/supabaseClient').then(({ supabase }) =>
                        supabase.from('audit_phase_activities').insert(defaultActivities as any)
                    );
                    if (actErr) console.warn('No se pudieron crear actividades por defecto:', actErr.message || actErr);
                } catch (ae) {
                    console.warn('Error al crear actividades por defecto', ae);
                }

                onSave(data.id);
                onClose();
            }
        } catch (e: any) {
            setField('error', `Error al guardar: ${e.message}`);
        } finally {
            setField('isSaving', false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="glass rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-slate-700">
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-2xl font-bold text-white">Planificar Nueva Auditoría</h2>
                    <p className="text-sm text-slate-400 mt-1">Defina los parámetros clave para la nueva auditoría.</p>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-5">
                    <div>
                        <label htmlFor="auditName" className="block text-sm font-medium text-slate-300 mb-1">Nombre de la Auditoría</label>
                        <input 
                            id="auditName"
                            type="text" 
                            value={name}
                            onChange={(e) => setField('name', e.target.value)}
                            className={`w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${validationErrors.name ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.name && <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Auditor Responsable</label>
                        <EnhancedSelect 
                            options={auditorOptions}
                            value={auditorId}
                            onChange={(val) => setField('auditorId', val)}
                            placeholder="Seleccione un auditor"
                        />
                    </div>

                    <AuditDatesSection
                        startDate={startDate}
                        setStartDate={(val) => setField('startDate', val)}
                        endDate={endDate}
                        setEndDate={(val) => setField('endDate', val)}
                        fieldErrors={validationErrors}
                        inputBaseStyles="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    />
                    <AuditScopeSection
                        scopeLevel={scopeLevel}
                        setScopeLevel={(val) => setField('scopeLevel', val)}
                        scopeEntity={scopeEntity}
                        setScopeEntity={(val) => setField('scopeEntity', val)}
                        scopeLevelOptions={scopeLevelOptions}
                        scopeEntityOptions={scopeEntityOptions}
                        fieldErrors={validationErrors}
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Proyecto Asociado (Opcional)</label>
                        <EnhancedSelect 
                            options={projectOptions}
                            value={selectedProjectId}
                            onChange={(val) => setField('selectedProjectId', val)}
                            placeholder="Seleccione un proyecto"
                        />
                    </div>

                    {error && (
                        <div className="p-3 my-2 text-sm text-center text-red-200 bg-red-500/20 rounded-md border border-red-500/30">
                            {error}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-900/50 backdrop-blur-sm border-t border-slate-700 flex justify-end items-center gap-4">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-all shadow-md hover:shadow-lg disabled:bg-slate-500 disabled:cursor-not-allowed">
                        {isSaving ? 'Guardando...' : 'Guardar Auditoría'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateAuditModal;
