import React, { useState, useEffect } from 'react';
import { getSubTaskSuggestions } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';

interface SubTaskSuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (selectedSuggestions: string[]) => void;
    taskDescription: string;
    taskCategory: string;
}

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-5 w-5 bg-slate-200 rounded"></div>
                <div className="h-4 flex-1 bg-slate-200 rounded"></div>
            </div>
        ))}
    </div>
);


const SubTaskSuggestionModal: React.FC<SubTaskSuggestionModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    taskDescription,
    taskCategory
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchSuggestions = async () => {
                setIsLoading(true);
                setError(null);
                setSuggestions([]);
                setSelectedSuggestions(new Set());
                try {
                    const result = await getSubTaskSuggestions(taskDescription, taskCategory);
                    setSuggestions(result);
                    // Pre-select all suggestions by default
                    setSelectedSuggestions(new Set(result));
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchSuggestions();
        }
    }, [isOpen, taskDescription, taskCategory]);

    if (!isOpen) return null;
    
    const handleToggleSelection = (suggestion: string) => {
        const newSelection = new Set(selectedSuggestions);
        if (newSelection.has(suggestion)) {
            newSelection.delete(suggestion);
        } else {
            newSelection.add(suggestion);
        }
        setSelectedSuggestions(newSelection);
    };

    const handleSelectAll = () => {
        if(selectedSuggestions.size === suggestions.length) {
            setSelectedSuggestions(new Set());
        } else {
            setSelectedSuggestions(new Set(suggestions));
        }
    }

    const handleSubmit = () => {
        onSubmit(Array.from(selectedSuggestions));
    };

    const handleCreateManually = () => {
        onSubmit([]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="bg-white text-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-7 h-7 text-brand-secondary" />
                        <div>
                            <h2 className="text-xl font-bold text-brand-primary">Sugerencias de Sub-tareas por IA</h2>
                            <p className="text-sm text-slate-500 mt-1">Revisa y selecciona las sub-tareas sugeridas para empezar rápidamente.</p>
                        </div>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-5">
                    {isLoading && <LoadingSkeleton />}
                    {error && (
                        <div className="text-center p-6 bg-red-50 text-red-700 rounded-lg">
                            <h3 className="font-semibold">Error al obtener sugerencias</h3>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    )}
                    {!isLoading && !error && suggestions.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-600">Seleccione las sub-tareas a crear:</h4>
                                <div className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id="select-all"
                                      className="h-4 w-4 rounded border-gray-300 text-brand-secondary focus:ring-brand-secondary"
                                      checked={selectedSuggestions.size === suggestions.length}
                                      onChange={handleSelectAll}
                                    />
                                    <label htmlFor="select-all" className="ml-2 text-sm text-slate-600">
                                        Seleccionar todo
                                    </label>
                                </div>
                            </div>
                            <ul className="space-y-3">
                                {suggestions.map((suggestion, index) => (
                                    <li key={index} className="flex items-start gap-3 p-3 rounded-md transition-colors bg-slate-50 hover:bg-slate-100">
                                        <input
                                            type="checkbox"
                                            id={`suggestion-${index}`}
                                            checked={selectedSuggestions.has(suggestion)}
                                            onChange={() => handleToggleSelection(suggestion)}
                                            className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-secondary focus:ring-brand-secondary cursor-pointer"
                                        />
                                        <label htmlFor={`suggestion-${index}`} className="flex-1 text-base text-slate-800 cursor-pointer">
                                            {suggestion}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50/70 backdrop-blur-sm border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3">
                    <button
                        onClick={handleCreateManually}
                        className="px-6 py-2.5 text-sm w-full sm:w-auto font-semibold text-slate-700 bg-transparent rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                    >
                        O crear manualmente
                    </button>
                    <div className="flex w-full sm:w-auto gap-3">
                         <button 
                            onClick={onClose}
                            className="px-6 py-2.5 w-full sm:w-auto text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={selectedSuggestions.size === 0 || isLoading}
                            className="px-6 py-2.5 w-full sm:w-auto text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary focus:outline-none focus:ring-4 focus:ring-blue-400/50 transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            Crear {selectedSuggestions.size > 0 ? `${selectedSuggestions.size} ` : ''}Sub-tarea{selectedSuggestions.size !== 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubTaskSuggestionModal;