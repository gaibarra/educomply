import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Audit, AuditFinding, Database } from '../types';
import FindingItem from './FindingItem';
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

                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-600">Hallazgos Cerrados</span>
                        <span className="text-sm font-bold text-brand-secondary">{closedFindings} de {totalFindings}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div className="bg-brand-secondary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
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
        </div>
    );
};

export default AuditCard;