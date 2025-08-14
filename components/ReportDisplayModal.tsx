import React, { useRef } from 'react';
import type { GeneratedReport } from '../types';

interface ReportDisplayModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: GeneratedReport | null;
}

// Simple markdown to HTML renderer
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    const elements = lines.map((line, index) => {
        if (line.startsWith('# ')) {
            return <h2 key={index} className="text-2xl font-extrabold text-gradient mt-6 mb-3 border-b border-white/10 pb-2">{line.substring(2)}</h2>;
        }
        if (line.startsWith('## ')) {
            return <h3 key={index} className="text-xl font-bold text-slate-100 mt-5 mb-2">{line.substring(3)}</h3>;
        }
        if (line.startsWith('### ')) {
            return <h4 key={index} className="text-lg font-semibold text-slate-200 mt-4 mb-1">{line.substring(4)}</h4>;
        }
        if (line.startsWith('* ')) {
            return <li key={index} className="ml-6 list-disc text-slate-200">{line.substring(2)}</li>;
        }
        if (line.trim() === '---') {
            return <hr key={index} className="my-6" />;
        }
        // Bold text with **text**
        const parts = line.split('**');
        const renderedParts = parts.map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
        );
    return <p key={index} className="text-slate-200 mb-2 leading-relaxed">{renderedParts}</p>;
    });
    return <>{elements}</>;
};


const ReportDisplayModal: React.FC<ReportDisplayModalProps> = ({ isOpen, onClose, report }) => {
    const reportContentRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !report) return null;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && reportContentRef.current) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${report.title}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .no-print { display: none; }
                            }
                            body { font-family: sans-serif; }
                        </style>
                    </head>
                    <body class="p-8">
                        ${reportContentRef.current.innerHTML}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                 printWindow.print();
                 printWindow.close();
            }, 250);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="glass rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
                <div className="p-5 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-extrabold text-gradient">{report.title}</h2>
                    <button onClick={onClose} className="p-2 text-slate-300 hover:bg-white/10 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div ref={reportContentRef} className="flex-grow overflow-y-auto p-8 bg-transparent">
                    <MarkdownRenderer content={report.content} />
                </div>

                <div className="p-4 bg-white/5 backdrop-blur-sm border-t border-white/10 flex justify-end items-center gap-4">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-semibold text-slate-100 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        Cerrar
                    </button>
                    <button onClick={handlePrint} className="px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-md hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}>
                        Imprimir
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportDisplayModal;
