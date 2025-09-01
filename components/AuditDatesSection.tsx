import React from 'react';

interface AuditDatesSectionProps {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  fieldErrors: { [key: string]: string };
  inputBaseStyles: string;
}

const AuditDatesSection: React.FC<AuditDatesSectionProps> = ({ startDate, setStartDate, endDate, setEndDate, fieldErrors, inputBaseStyles }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div className="space-y-1.5">
      <label htmlFor="start-date" className="text-sm font-medium text-slate-300">Fecha de Inicio</label>
      <input
        id="start-date"
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        className={`${inputBaseStyles} ${fieldErrors.startDate ? 'border-red-500' : ''}`}
        aria-required="true"
        aria-invalid={!!fieldErrors.startDate}
        aria-describedby={fieldErrors.startDate ? 'start-date-error' : undefined}
      />
      {fieldErrors.startDate && <p id="start-date-error" className="text-xs text-red-500 mt-1">{fieldErrors.startDate}</p>}
    </div>
    <div className="space-y-1.5">
      <label htmlFor="end-date" className="text-sm font-medium text-slate-300">Fecha de Fin</label>
      <input
        id="end-date"
        type="date"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        className={`${inputBaseStyles} ${fieldErrors.endDate ? 'border-red-500' : ''}`}
        aria-required="true"
        aria-invalid={!!fieldErrors.endDate}
        aria-describedby={fieldErrors.endDate ? 'end-date-error' : undefined}
      />
      {fieldErrors.endDate && <p id="end-date-error" className="text-xs text-red-500 mt-1">{fieldErrors.endDate}</p>}
    </div>
  </div>
);

export default AuditDatesSection;