
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Audit, Kpi } from '../types';
import KpiCard from './KpiCard';
import ChartBarIcon from './icons/ChartBarIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ClockRewindIcon from './icons/ClockRewindIcon';
import ExclamationCircleIcon from './icons/ExclamationCircleIcon';

const AuditTimeline: React.FC<{ audits: Audit[] }> = ({ audits }) => {
  const year = new Date().getFullYear();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(year, i, 1);
    return monthDate.toLocaleString('es-MX', { month: 'short' });
  });

  return (
    <div className="bg-gray-800 p-4 rounded-lg overflow-x-auto">
      <div className="relative" style={{ height: `${audits.length * 40 + 40}px` }}>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col">
          {/* Month markers */}
          <div className="flex h-8 items-center border-b border-gray-700">
            {months.map((month, i) => (
              <div key={month} className="text-xs text-gray-400 text-center border-r border-gray-700" style={{ width: `${100 / 12}%` }}>
                {month.toUpperCase()}
              </div>
            ))}
          </div>
          {/* Audit bars */}
          <div className="relative flex-1">
            {audits.map((audit, index) => {
              const auditStart = new Date(audit.start_date);
              const auditEnd = new Date(audit.end_date);

              const startOffset = (auditStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const endOffset = (auditEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

              const left = (startOffset / totalDays) * 100;
              const width = ((endOffset - startOffset) / totalDays) * 100;

              return (
                <div 
                  key={audit.id} 
                  className="absolute h-8 flex items-center px-2 rounded-lg bg-blue-500 text-white text-sm truncate"
                  style={{ 
                    top: `${index * 40 + 10}px`, 
                    left: `${left}%`, 
                    width: `${width}%`,
                    minWidth: '20px'
                  }}
                  title={`${audit.name} (${auditStart.toLocaleDateString()} - ${auditEnd.toLocaleDateString()})`}
                >
                  {audit.name}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditsDashboard: React.FC = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudits = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('audits')
          .select('*, findings:audit_findings(*)');
        
        if (error) throw error;
        setAudits(data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, []);

  const kpis: Kpi[] = [
    {
      title: 'Auditorías Totales',
      value: audits.length,
      change: '0',
      changeType: 'increase',
    },
    {
      title: 'En Progreso',
      value: audits.filter(a => a.status === 'En Progreso').length,
      change: '0',
      changeType: 'increase',
    },
    {
      title: 'Completadas',
      value: audits.filter(a => a.status === 'Completada').length,
      change: '0',
      changeType: 'increase',
    },
    {
      title: 'Hallazgos Abiertos',
      value: audits.reduce((acc, audit) => {
        const findings = Array.isArray(audit.findings) ? audit.findings : [];
        return acc + findings.filter(f => f.status === 'Abierto').length;
      }, 0),
      change: '0',
      changeType: 'increase',
    },
  ];
  
  const kpiIcons = [
    <ChartBarIcon className="w-6 h-6 text-white" />,
    <ClockRewindIcon className="w-6 h-6 text-white" />,
    <ClipboardCheckIcon className="w-6 h-6 text-white" />,
    <ExclamationCircleIcon className="w-6 h-6 text-white" />,
  ];

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-white mb-6">Dashboard de Auditorías</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <KpiCard key={index} kpi={kpi} icon={kpiIcons[index]} />
        ))}
      </div>

      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Línea de Tiempo de Auditorías</h3>
        <AuditTimeline audits={audits} />
      </div>
    </div>
  );
};

export default AuditsDashboard;
