import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuditFinding, FindingSeverity, FindingStatus, Profile, Database } from '../types';
import FlagIcon from './icons/FlagIcon';
import TrashIcon from './icons/TrashIcon';

interface FindingItemProps {
    finding: AuditFinding;
    onUpdate: (updatedFinding: AuditFinding) => void;
    onDelete: (findingId: number) => void;
}

const severityConfig: Record<FindingSeverity, { label: string; classes: string }> = {
    'Crítico': { label: 'Crítico', classes: 'bg-red-100 text-red-800 border-red-300' },
    'Mayor': { label: 'Mayor', classes: 'bg-orange-100 text-orange-800 border-orange-300' },
    'Menor': { label: 'Menor', classes: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'Observación': { label: 'Observación', classes: 'bg-blue-100 text-blue-800 border-blue-300' },
};

const statusConfig: Record<FindingStatus, { label: string; classes: string }> = {
    'Abierto': { label: 'Abierto', classes: 'bg-slate-200 text-slate-800' },
    'Cerrado': { label: 'Cerrado', classes: 'bg-green-200 text-green-800' },
};

const FindingItem: React.FC<FindingItemProps> = ({ finding, onUpdate, onDelete }) => {
    
    const handleUpdateField = async (
        updates: Database['public']['Tables']['audit_findings']['Update']
    ) => {
        onUpdate({ ...finding, ...updates });

        const { error } = await supabase
            .from('audit_findings')
            .update(updates)
            .eq('id', finding.id);

        if (error) {
            console.error(`Error updating finding:`, error);
            // Revert on error
            onUpdate(finding);
        }
    };
    
    const inputClasses = "w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent";
    const selectClasses = "p-1 -ml-1 border border-transparent rounded-md text-slate-600 bg-transparent hover:bg-slate-100 hover:border-slate-200 focus:ring-1 focus:ring-brand-secondary focus:bg-white";


    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex justify-between items-start gap-4">
                 <div className="flex-1 space-y-3">
                     <div>
                        <label className="text-xs font-semibold text-slate-500">Descripción del Hallazgo</label>
                        <textarea
                            value={finding.description}
                            onChange={(e) => onUpdate({ ...finding, description: e.target.value })}
                            onBlur={(e) => handleUpdateField({ description: e.target.value })}
                            className={`${inputClasses} min-h-[60px]`}
                            placeholder="Describa el hallazgo..."
                        />
                     </div>
                     <div>
                        <label className="text-xs font-semibold text-slate-500">Recomendación</label>
                         <textarea
                            value={finding.recommendation}
                            onChange={(e) => onUpdate({ ...finding, recommendation: e.target.value })}
                            onBlur={(e) => handleUpdateField({ recommendation: e.target.value })}
                            className={`${inputClasses} min-h-[60px]`}
                            placeholder="Recomiende una acción correctiva..."
                        />
                     </div>
                 </div>
                 <div className="w-40 flex-shrink-0 space-y-4">
                     <div>
                        <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1">
                            <FlagIcon className="w-3.5 h-3.5" />
                            Severidad
                        </label>
                        <select
                            value={finding.severity}
                            onChange={e => handleUpdateField({ severity: e.target.value as FindingSeverity })}
                            className={`w-full text-xs font-bold p-1.5 rounded-md border ${severityConfig[finding.severity].classes}`}
                        >
                            {Object.keys(severityConfig).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1">Estado</label>
                        <select
                            value={finding.status}
                            onChange={e => handleUpdateField({ status: e.target.value as FindingStatus })}
                            className={`w-full text-xs font-bold p-1.5 rounded-md border ${statusConfig[finding.status].classes}`}
                        >
                            <option value="Abierto">Abierto</option>
                            <option value="Cerrado">Cerrado</option>
                        </select>
                     </div>
                     <button onClick={() => onDelete(finding.id)} className="w-full flex items-center justify-center gap-1.5 p-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors">
                        <TrashIcon className="w-3.5 h-3.5" />
                        Eliminar
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default FindingItem;