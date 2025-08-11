import React from 'react';
import type { ComplianceObligation } from '../types';

const getStatusClasses = (status: ComplianceObligation['status']) => {
  switch (status) {
    case 'Cumplido':
      return 'bg-green-100 text-green-800';
    case 'Pendiente':
      return 'bg-yellow-100 text-yellow-800';
    case 'Vencido':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const ComplianceItemCard: React.FC<{ item: ComplianceObligation }> = ({ item }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-brand-secondary flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
      <div className="flex-1">
        <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
        <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
          <span>
            <strong>Categoría:</strong> {item.category}
          </span>
          <span>
            <strong>Autoridad:</strong> {item.authority}
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-6 w-full sm:w-auto">
        <div className="text-sm">
          <p className="font-semibold text-slate-600">Vencimiento</p>
          <p className="text-slate-500">{item.dueDate}</p>
        </div>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusClasses(item.status)}`}>
            {item.status}
          </span>
          <button className="text-brand-secondary hover:text-brand-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceItemCard;