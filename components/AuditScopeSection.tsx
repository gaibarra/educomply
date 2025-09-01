import React from 'react';
import EnhancedSelect from './EnhancedSelect';

interface AuditScopeSectionProps {
  scopeLevel: string;
  setScopeLevel: (v: string) => void;
  scopeEntity: string;
  setScopeEntity: (v: string) => void;
  scopeLevelOptions: any[];
  scopeEntityOptions: any[];
  fieldErrors: { [key: string]: string };
}

const AuditScopeSection: React.FC<AuditScopeSectionProps> = ({ scopeLevel, setScopeLevel, scopeEntity, setScopeEntity, scopeLevelOptions, scopeEntityOptions, fieldErrors }) => (
  <div>
    <h4 className="text-sm font-medium text-slate-300 mb-2">Ámbito de Aplicación</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-800/50 rounded-md border border-slate-700">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400">Nivel</label>
        <EnhancedSelect
          value={scopeLevel}
          onChange={v => { setScopeLevel((v as any) || 'General'); setScopeEntity(''); }}
          options={scopeLevelOptions}
          placeholder="Seleccionar nivel"
          error={fieldErrors.scopeLevel}
        />
      </div>
      {scopeLevel !== 'General' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">{scopeLevel} Específico</label>
          <EnhancedSelect
            value={scopeEntity || null}
            onChange={v => setScopeEntity(v || '')}
            options={scopeEntityOptions}
            placeholder="Seleccione una entidad..."
            searchable={scopeEntityOptions.length > 8}
            disabled={scopeEntityOptions.length === 0}
            error={fieldErrors.scopeEntity}
          />
        </div>
      )}
    </div>
  </div>
);

export default AuditScopeSection;