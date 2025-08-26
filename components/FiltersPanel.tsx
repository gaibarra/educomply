import React from 'react';

const FiltersPanel: React.FC<{
    obligationFilter: 'Todas' | 'Pendiente' | 'Vencido';
    setObligationFilter: (v: 'Todas' | 'Pendiente' | 'Vencido') => void;
    // mobile drawer controls
    isOpen?: boolean;
    onClose?: () => void;
}> = ({ obligationFilter, setObligationFilter, isOpen = false, onClose }) => {
    const content = (
        <div className="glass p-4 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-200">Filtros rápidos</h4>
                {onClose && (
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-100 p-1 rounded-md lg:hidden">
                        ✕
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2 bg-white/5 border border-white/10 rounded-full p-1">
                    {(['Todas', 'Pendiente', 'Vencido'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setObligationFilter(opt)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${obligationFilter === opt ? 'text-white' : 'text-slate-300'}`}
                            style={obligationFilter === opt ? { background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' } : {}}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                <div className="mt-4">
                    <h5 className="text-xs text-slate-300 mb-2">Acciones</h5>
                    <button className="w-full text-left px-3 py-2 rounded-md bg-white/3 text-slate-100 hover:bg-white/10">Crear tarea</button>
                    <button className="w-full text-left px-3 py-2 rounded-md bg-white/3 text-slate-100 hover:bg-white/10 mt-2">Exportar</button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop panel */}
            <aside className="hidden lg:block w-64 pr-4">
                <div className="sticky top-6">{content}</div>
            </aside>
            {/* Mobile drawer */}
            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
                    <div className="relative w-80 max-w-full h-full p-4">
                        <div className="h-full overflow-auto">{content}</div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FiltersPanel;
