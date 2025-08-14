import React, { useState } from 'react';
import type { Profile, PredefinedReportType, GeneratedReport } from '../types';
import { generateReport } from '../services/geminiService';
import ReportCard from './ReportCard';
import ReportDisplayModal from './ReportDisplayModal';
import AlertModal from './AlertModal';

import DocumentChartBarIcon from './icons/DocumentChartBarIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import SparklesIcon from './icons/SparklesIcon';


const predefinedReports: {
    type: PredefinedReportType;
    title: string;
    description: string;
    icon: React.ReactNode;
}[] = [
    {
        type: 'general_status',
        title: 'Estado General de Cumplimiento',
        description: 'Un resumen ejecutivo con KPIs clave, estado de tareas y riesgos principales.',
        icon: <DocumentChartBarIcon className="w-8 h-8" />
    },
    {
        type: 'tasks_by_area',
        title: 'Tareas por Área Responsable',
        description: 'Desglose del estado de las tareas (pendientes, en progreso, vencidas) para cada área.',
        icon: <ClipboardCheckIcon className="w-8 h-8" />
    },
    {
        type: 'overdue_tasks',
        title: 'Tareas Vencidas y Próximas',
        description: 'Lista crítica de todas las tareas atrasadas y aquellas que vencerán en los próximos 30 días.',
        icon: <ExclamationTriangleIcon className="w-8 h-8" />
    },
    {
        type: 'audit_findings',
        title: 'Hallazgos de Auditoría Abiertos',
        description: 'Informe de todos los hallazgos de auditoría que aún no se han cerrado, por severidad.',
        icon: <ShieldCheckIcon className="w-8 h-8" />
    },
    {
        type: 'workload_by_person',
        title: 'Carga de Trabajo por Persona',
        description: 'Análisis de la distribución de tareas y su estado para cada miembro del equipo.',
        icon: <UserCircleIcon className="w-8 h-8" />
    }
];

const ReportesView: React.FC<{ profile: Profile }> = ({ profile }) => {
    const [loadingReport, setLoadingReport] = useState<PredefinedReportType | 'ai' | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [alertInfo, setAlertInfo] = useState<{ isOpen: boolean; title: string; message: string }>({
        isOpen: false,
        title: '',
        message: '',
    });

    const handleGenerateReport = async (
        request: { type: 'predefined'; reportType: PredefinedReportType } | { type: 'ai'; query: string }
    ) => {
        const loadingKey = request.type === 'predefined' ? request.reportType : 'ai';
        if (request.type === 'ai' && !request.query.trim()) {
            setAlertInfo({ isOpen: true, title: "Consulta Vacía", message: "Por favor, describa el reporte que necesita." });
            return;
        }

        setLoadingReport(loadingKey);
        setAlertInfo({ isOpen: false, title: '', message: '' });

        try {
            const report = await generateReport(request);
            setGeneratedReport(report);
            setIsModalOpen(true);
        } catch (error: any) {
            console.error("Error generating report:", error);
            setAlertInfo({
                isOpen: true,
                title: "Error al Generar Reporte",
                message: error.message || "Ocurrió un error inesperado. Por favor, intente de nuevo."
            });
        } finally {
            setLoadingReport(null);
        }
    };
    
    return (
        <>
            <div className="p-6 md:p-8">
                <h2 className="text-3xl font-extrabold text-gradient mb-2">Generación de Reportes</h2>
                <p className="text-slate-200/80 mb-8">Obtenga vistas detalladas y resúmenes inteligentes sobre el estado de su cumplimiento.</p>

                <div className="glass p-6 rounded-xl shadow-lg mb-8 border border-white/10">
                    <h3 className="text-2xl font-extrabold text-gradient mb-5">Reportes Predefinidos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {predefinedReports.map(report => (
                            <ReportCard
                                key={report.type}
                                icon={report.icon}
                                title={report.title}
                                description={report.description}
                                onGenerate={() => handleGenerateReport({ type: 'predefined', reportType: report.type })}
                                isLoading={loadingReport === report.type}
                            />
                        ))}
                    </div>
                </div>

                <div className="glass p-6 rounded-xl shadow-lg border border-white/10">
                     <div className="flex items-center gap-3 mb-4">
                        <SparklesIcon className="w-8 h-8 text-yellow-400" />
                        <h3 className="text-2xl font-extrabold text-gradient">Reporte Personalizado con IA</h3>
                    </div>
                    <p className="text-sm text-slate-200/80 mb-4">
                        Describa en lenguaje natural el reporte que necesita. La IA analizará los datos y lo generará por usted.
                    </p>
                    <textarea
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        className="w-full p-3 border border-white/10 bg-white/5 text-slate-100 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition min-h-[100px] resize-y"
                        placeholder='Ej: "Genera un reporte ejecutivo que resuma el estado de cumplimiento del Campus Norte para el último trimestre, destacando los riesgos principales y las tareas asignadas a Juan Pérez."'
                        disabled={loadingReport === 'ai'}
                    />
                    <div className="text-right mt-4">
                        <button
                            onClick={() => handleGenerateReport({ type: 'ai', query: aiQuery })}
                            disabled={loadingReport === 'ai' || !aiQuery.trim()}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-bold text-white rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-400/30 disabled:bg-slate-500/50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}
                        >
                            {loadingReport === 'ai' ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Analizando y Generando...</span>
                                </>
                            ) : (
                                 <>
                                    <SparklesIcon className="w-5 h-5" />
                                    <span>Generar con IA</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            <ReportDisplayModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                report={generatedReport}
            />

             <AlertModal
                isOpen={alertInfo.isOpen}
                onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
                title={alertInfo.title}
                message={alertInfo.message}
            />
        </>
    );
};

export default ReportesView;
