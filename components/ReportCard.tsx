import React from 'react';

interface ReportCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onGenerate: () => void;
    isLoading?: boolean;
}

const ReportCard: React.FC<ReportCardProps> = ({ icon, title, description, onGenerate, isLoading = false }) => {
    return (
        <div className="glass p-6 rounded-xl shadow-xl border border-white/10 flex flex-col items-start gap-4 transition-all duration-300 hover-3d animate-floating">
            <div className="p-4 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)' }}>
                {icon}
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-extrabold text-gradient">{title}</h3>
                <p className="text-sm text-slate-200 mt-2 min-h-[40px]">{description}</p>
            </div>
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-400/30 disabled:bg-slate-500/50 disabled:cursor-not-allowed animate-pulse-glow"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)' }}
            >
                {isLoading ? (
                     <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Generando...</span>
                    </>
                ) : (
                    <span>Generar Reporte</span>
                )}
            </button>
        </div>
    );
};

export default ReportCard;
