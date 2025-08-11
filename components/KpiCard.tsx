import React from 'react';
import type { Kpi } from '../types';

interface ArrowProps {
  type: 'increase' | 'decrease';
}

const Arrow: React.FC<ArrowProps> = ({ type }) => {
  const isIncrease = type === 'increase';
  const color = isIncrease ? 'text-status-success' : 'text-status-danger';
  const rotation = isIncrease ? '' : 'transform rotate-180';

  return (
    <svg className={`w-5 h-5 ${color} ${rotation}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.03 9.77a.75.75 0 01-1.06-1.06l5.25-5.25a.75.75 0 011.06 0l5.25 5.25a.75.75 0 11-1.06 1.06L10.75 5.612V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
    </svg>
  );
};

const KpiCard: React.FC<{ kpi: Kpi; icon: React.ReactNode }> = ({ kpi, icon }) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-md flex items-start space-x-4 transition-transform hover:scale-105 duration-300">
      <div className="bg-brand-secondary/10 p-3 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
        <p className="text-3xl font-bold text-slate-800">{kpi.value}</p>
        <div className="flex items-center mt-1 text-sm">
          <Arrow type={kpi.changeType} />
          <span className={`${kpi.changeType === 'increase' ? 'text-status-success' : 'text-status-danger'} font-semibold`}>
            {kpi.change}
          </span>
          <span className="text-slate-400 ml-1">vs mes anterior</span>
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
