import React, { useState, useEffect, useCallback, useMemo } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { getComplianceAnalysis } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import type { AiComplianceResponse, EditableAiObligation, ResponsibleArea, Task, ScopeLevel, ScopeSelection, Profile, View, InstitutionProfileRow } from '../types';
import PlusCircleIcon from './icons/PlusCircleIcon';
import TasksReviewModal from './TasksReviewModal';
import CalendarIcon from './icons/CalendarIcon';
import AlertModal from './AlertModal';
import DocumentTextIcon from './icons/DocumentTextIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import SparklesIcon from './icons/SparklesIcon';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
    </div>
);

type DynamicScopeOptions = {
    'Campus': string[];
    'Nivel Educativo': string[];
    'Facultad/Escuela': string[];
};

const AiResultDisplay: React.FC<{
    summary: string;
    obligations: EditableAiObligation[];
    onObligationChange: (id: string, field: keyof Omit<EditableAiObligation, 'documents' | 'scope'>, value: any) => void;
    onScopeChange: (id: string, scope: ScopeSelection) => void;
    onDocumentSelectionChange: (id: string, docName: string, selected: boolean) => void;
    responsibleAreas: ResponsibleArea[];
    onAddResponsibleArea: (areaName: string) => Promise<number | null>;
    responsiblePersons: Profile[];
    onAddObligation: () => void;
    onCreateTasks: () => void;
    onReplicateData: (sourceId: string) => void;
    scopeOptions: DynamicScopeOptions;
}> = ({ summary, obligations, onObligationChange, onScopeChange, onDocumentSelectionChange, responsibleAreas, onAddResponsibleArea, responsiblePersons, onAddObligation, onCreateTasks, onReplicateData, scopeOptions }) => {
    const [addingAreaFor, setAddingAreaFor] = useState<string | null>(null);
    const [newAreaName, setNewAreaName] = useState('');

    const handleAreaSelectChangeValue = async (val: string, obligationId: string) => {
        if (val === 'ADD_NEW_AREA') {
            setAddingAreaFor(obligationId);
            setNewAreaName('');
        } else {
            if(val === '') onObligationChange(obligationId, 'responsible_area_id', null);
            else onObligationChange(obligationId, 'responsible_area_id', Number(val));
        }
    };

    const handleSaveNewArea = async (obligationId: string) => {
        const trimmedArea = newAreaName.trim();
        if (trimmedArea) {
            const newAreaId = await onAddResponsibleArea(trimmedArea);
            if (newAreaId) {
                onObligationChange(obligationId, 'responsible_area_id', newAreaId);
            }
            setAddingAreaFor(null);
        }
    };

    const selectedObligations = obligations.filter(o => o.selected);
    const selectedCount = selectedObligations.length;
    const firstSelectedId = selectedObligations[0]?.id;

    return (
    <div className="mt-10 bg-white dark:bg-slate-800/70 p-6 md:p-8 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 animate-fade-in backdrop-blur-sm">
        <h3 className="text-2xl font-bold text-brand-primary dark:text-slate-100 mb-6 flex items-center gap-3">
            <SparklesIcon className="h-7 w-7 text-brand-accent animate-pulse-glow"/>
            Análisis de Cumplimiento por IA
        </h3>
        
        <div className="mb-8">
            <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b-2 border-brand-accent pb-2 mb-4 tracking-wide uppercase">Resumen</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{summary}</p>
        </div>

        <div className="mb-8">
            <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b-2 border-brand-accent pb-2 mb-4 tracking-wide uppercase">Obligaciones y Recomendaciones</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Seleccione los elementos, asigne responsables, fechas y ámbito. Se convertirán en tareas de seguimiento.</p>
            <ul className="space-y-5">
                {obligations.map((item) => (
                    <li key={item.id} className={`group relative bg-slate-50 dark:bg-slate-900/40 p-5 rounded-lg border-l-4 transition-all duration-300 ${item.selected ? 'border-brand-secondary shadow-sm ring-1 ring-brand-secondary/20' : 'border-slate-200 dark:border-slate-700'} hover:shadow-md` }>
                        <div className="flex items-start gap-4">
                            <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => onObligationChange(item.id, 'selected', e.target.checked)}
                                className="mt-2 h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-brand-secondary focus:ring-brand-secondary cursor-pointer shadow-sm"
                                aria-label={`Seleccionar obligación: ${item.obligation}`}
                            />

                            <div className="flex-1">
                                <textarea
                                    value={item.obligation}
                                    onChange={(e) => onObligationChange(item.id, 'obligation', e.target.value)}
                                    className={`w-full p-2 border rounded-md transition-all duration-200 text-base resize-none leading-snug ${item.selected ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-medium shadow-sm focus:ring-2 focus:ring-brand-secondary/40' : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 group-hover:bg-white/40 dark:group-hover:bg-slate-800/30'}`}
                                    rows={item.selected ? 2 : 1}
                                    disabled={!item.selected}
                                    aria-label="Descripción de la obligación"
                                    placeholder="Describa la obligación específica..."
                                />
                                
                                {!item.selected && (
                                    <div className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap">
                                        <p className="truncate max-w-full"><span className="font-semibold">Fuente:</span> {item.source}</p>
                                        <span className='bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium tracking-wide uppercase'>
                                            {item.category}
                                        </span>
                                    </div>
                                )}
                                
                                {item.selected && (
                     <div className="mt-5 space-y-5">
                                        {item.id === firstSelectedId && selectedCount > 1 && (
                         <div className="p-3 bg-yellow-50 dark:bg-yellow-100/10 border border-dashed border-yellow-300 dark:border-yellow-400/60 rounded-md transition-all animate-fade-in">
                                                 <button
                                                     onClick={() => onReplicateData(item.id)}
                             className="flex items-center gap-2.5 text-sm font-semibold text-yellow-800 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-200 transition-colors w-full justify-center p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-400/10"
                                                 >
                                                     <SparklesIcon className="h-5 w-5 text-yellow-500"/>
                                                     <span>Replicar datos en los <strong>{selectedCount - 1}</strong> otros elementos seleccionados</span>
                                                 </button>
                                             </div>
                                        )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 p-5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">
                                            {/* Fuente Legal */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`source-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Fuente Legal</label>
                                                <input
                                                    id={`source-${item.id}`} type="text" value={item.source}
                                                    onChange={(e) => onObligationChange(item.id, 'source', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700/60 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-secondary/40"
                                                    placeholder="Ej: Ley General de Educación, Art. 15"
                                                />
                                            </div>
                                            {/* Categoría */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`cat-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Categoría</label>
                                                <input
                                                    id={`cat-${item.id}`} type="text" value={item.category}
                                                    onChange={(e) => onObligationChange(item.id, 'category', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700/60 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-secondary/40"
                                                    placeholder="Ej: Laboral"
                                                />
                                            </div>
                                            {/* Fecha Compromiso */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`due-date-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Fecha Compromiso</label>
                                                <div className="relative">
                                                    <input id={`due-date-${item.id}`} type="date" value={item.due_date} onChange={(e) => onObligationChange(item.id, 'due_date', e.target.value)} className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700/60 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100 pr-9 focus:ring-2 focus:ring-brand-secondary/40"/>
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-slate-500">
                                                        <CalendarIcon className="h-5 w-5" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Área Responsable */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`resp-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Área Responsable</label>
                                                {addingAreaFor === item.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input type="text" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveNewArea(item.id)} className="flex-grow p-2 border rounded-md text-sm bg-white dark:bg-slate-700/60 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-secondary/40" placeholder="Nueva área" autoFocus />
                                                        <button onClick={() => handleSaveNewArea(item.id)} className="p-2 bg-status-success text-white rounded-md hover:bg-green-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                                                        <button onClick={() => setAddingAreaFor(null)} className="p-2 bg-status-danger text-white rounded-md hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                    </div>
                                                ) : (
                                                    <EnhancedSelect
                                                        value={item.responsible_area_id ? String(item.responsible_area_id) : ''}
                                                        onChange={(v)=> handleAreaSelectChangeValue(v || '', item.id)}
                                                        options={[{value:'',label:'Sin asignar'}, ...responsibleAreas.map(a=>({value:String(a.id), label:a.name})), {value:'ADD_NEW_AREA', label:'+ Agregar nueva área...'}]}
                                                        placeholder="Área responsable"
                                                    />
                                                )}
                                            </div>
                                            {/* Persona Responsable */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`person-${item.id}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">Persona Responsable</label>
                                                <EnhancedSelect
                                                    value={item.responsible_person_id ? String(item.responsible_person_id) : ''}
                                                    onChange={(v)=> onObligationChange(item.id, 'responsible_person_id', v || null)}
                                                    options={[{value:'',label:'Sin asignar'}, ...responsiblePersons.map(p=>({ value:String(p.id), label:p.full_name }))]}
                                                    placeholder="Asignar persona"
                                                />
                                            </div>
                                        </div>
                                        {/* Ámbito de Aplicación */}
                                        <div className="p-5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">
                                            <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 tracking-wide uppercase">
                                                <BuildingOfficeIcon className="w-5 h-5 text-brand-secondary"/>
                                                Ámbito de Aplicación
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor={`scope-level-${item.id}`} className="text-xs font-medium text-slate-500 dark:text-slate-400">Nivel</label>
                                                    <EnhancedSelect
                                                        value={item.scope.level}
                                                        onChange={(v)=> onScopeChange(item.id, { level: (v || 'Institución') as ScopeLevel, entities: [] })}
                                                        options={[{value:'Institución', label:'Institución (Global)'}, ...(Object.keys(scopeOptions) as Array<keyof typeof scopeOptions>).map(level=>({ value: level, label: level }))]}
                                                        placeholder="Nivel"
                                                    />
                                                </div>
                                                {item.scope.level !== 'Institución' && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label htmlFor={`scope-entities-${item.id}`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            {item.scope.level} Específicos
                                                        </label>
                                                        <EnhancedSelect
                                                            multiple
                                                            value={item.scope.entities}
                                                            onChange={(vals)=> onScopeChange(item.id, { ...item.scope, entities: vals })}
                                                            options={(scopeOptions[item.scope.level as keyof typeof scopeOptions] || []).map(entity=>({ value: entity, label: entity }))}
                                                            placeholder="Seleccionar..."
                                                        />
                                                        <p className="text-xs text-slate-400 dark:text-slate-500">Puede buscar y seleccionar múltiples.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Documentos Sugeridos */}
                                        {item.documents && item.documents.length > 0 && (
                                            <div className="p-5 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">
                                                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 tracking-wide uppercase">
                                                    <DocumentTextIcon className="w-5 h-5 text-brand-secondary"/>
                                                    Documentos Sugeridos por IA
                                                </h5>
                                                <div className="space-y-2">
                                                    {item.documents.map(doc => (
                                                        <div key={doc.name} className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                id={`doc-${item.id}-${doc.name}`}
                                                                checked={doc.selected}
                                                                onChange={(e) => onDocumentSelectionChange(item.id, doc.name, e.target.checked)}
                                                                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-brand-secondary focus:ring-brand-secondary cursor-pointer"
                                                                aria-label={`Seleccionar documento: ${doc.name}`}
                                                            />
                                                            <label htmlFor={`doc-${item.id}-${doc.name}`} className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                                                {doc.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
             <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={onAddObligation}
                    className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary dark:text-brand-accent dark:hover:text-brand-secondary transition-colors"
                >
                    <PlusCircleIcon className="h-5 w-5"/>
                    Agregar Obligación Manualmente
                </button>
            </div>
        </div>
        
         <div className="mt-10 text-right">
            <button
                onClick={onCreateTasks}
                disabled={selectedCount === 0}
                className="bg-brand-secondary dark:bg-brand-primary text-white font-bold py-3 px-6 sm:px-8 rounded-lg hover:bg-brand-primary dark:hover:bg-brand-secondary focus:outline-none focus:ring-4 focus:ring-brand-secondary/40 dark:focus:ring-brand-primary/50 transition-all duration-300 text-base sm:text-lg shadow-lg hover:shadow-xl disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
            >
                Revisar y Crear {selectedCount > 0 ? `${selectedCount} ` : ''}Tarea{selectedCount !== 1 && 's'}
            </button>
        </div>
    </div>
    )
};


interface NormativasViewProps {
    profile: Profile;
    setActiveView: (view: View) => void;
    institutionProfile: InstitutionProfileRow | null;
}


const NormativasView: React.FC<NormativasViewProps> = ({ profile, setActiveView, institutionProfile }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<AiComplianceResponse | null>(null);
    const [editableObligations, setEditableObligations] = useState<EditableAiObligation[]>([]);
    
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [tasksToReview, setTasksToReview] = useState<Omit<Task, 'id'|'created_at'|'subTasks'|'responsible_area'|'responsible_person'>[]>([]);
    
    const [alertInfo, setAlertInfo] = useState<{isOpen: boolean; title: string; message: string}>({
        isOpen: false,
        title: '',
        message: '',
    });

    const [responsibleAreas, setResponsibleAreas] = useState<ResponsibleArea[]>([]);
    const [responsiblePersons, setResponsiblePersons] = useState<Profile[]>([]);

    const dynamicScopeOptions = useMemo((): DynamicScopeOptions => {
        if (!institutionProfile) {
            return { 'Campus': [], 'Nivel Educativo': [], 'Facultad/Escuela': [] };
        }
        const faculties = [...new Set(institutionProfile.academic_programs.map(p => p.faculty).filter(Boolean))];
        return {
            'Campus': institutionProfile.locations.map(l => l.name),
            'Nivel Educativo': institutionProfile.educational_levels,
            'Facultad/Escuela': faculties as string[],
        };
    }, [institutionProfile]);


    const fetchSupportData = useCallback(async () => {
        try {
            const { data: areasData, error: areasError } = await supabase.from('responsible_areas').select('id, name').order('name');
            if (areasError) throw areasError;
            setResponsibleAreas((areasData as any) || []);

            const { data: personsData, error: personsError } = await supabase.from('profiles').select('id, full_name, role, scope_entity').order('full_name');
            if (personsError) throw personsError;
            setResponsiblePersons((personsData as any) || []);

        } catch (error) {
            console.error("Error fetching support data:", error);
            setAlertInfo({ isOpen: true, title: "Error de Carga", message: "No se pudieron cargar las áreas y personas responsables." });
        }
    }, []);

    useEffect(() => {
        fetchSupportData();
    }, [fetchSupportData]);


    const handleCloseAlert = () => setAlertInfo({ isOpen: false, title: '', message: '' });

    const handleAddResponsibleArea = async (newAreaName: string): Promise<number | null> => {
        const trimmedArea = newAreaName.trim();
        if (trimmedArea && !responsibleAreas.some(a => a.name.toLowerCase() === trimmedArea.toLowerCase())) {
            const newArea = { name: trimmedArea };
            const { data, error } = await supabase
                .from('responsible_areas')
                .insert([newArea] as any)
                .select('id')
                .single();

            if (error) {
                console.error("Error adding area:", error);
                setAlertInfo({ isOpen: true, title: "Error", message: "No se pudo agregar el nueva área." });
                return null;
            }
            if (data) {
                await fetchSupportData(); // Re-fetch to update list
                return (data as any).id;
            }
        }
        return null;
    };
    

    const handleObligationChange = (id: string, field: keyof Omit<EditableAiObligation, 'documents' | 'scope'>, value: any) => {
        setEditableObligations(prev =>
            prev.map(ob =>
                ob.id === id ? { ...ob, [field]: value } : ob
            )
        );
    };
    
    const handleScopeChange = (id: string, scope: ScopeSelection) => {
        setEditableObligations(prev => 
            prev.map(ob => ob.id === id ? { ...ob, scope } : ob)
        );
    };

    const handleDocumentSelectionChange = (id: string, docName: string, selected: boolean) => {
        setEditableObligations(prev =>
            prev.map(ob => {
                if (ob.id === id) {
                    return {
                        ...ob,
                        documents: ob.documents.map(doc =>
                            doc.name === docName ? { ...doc, selected } : doc
                        )
                    };
                }
                return ob;
            })
        );
    };

    const handleAddObligation = () => {
        const newObligation: EditableAiObligation = {
            id: `manual-${Date.now()}`,
            obligation: 'Nueva obligación manual',
            source: '',
            category: 'General',
            selected: true,
            responsible_area_id: null,
            responsible_person_id: null,
            due_date: '',
            scope: { level: 'Institución', entities: [] },
            documents: [],
        };
        setEditableObligations(prev => [...prev, newObligation]);
    };

    const handleReplicateData = (sourceId: string) => {
        const sourceObligation = editableObligations.find(o => o.id === sourceId);
        if (!sourceObligation) return;

        const { responsible_area_id, responsible_person_id, due_date, scope } = sourceObligation;
        
        if (!responsible_person_id && !due_date && scope.level === 'Institución' && scope.entities.length === 0) {
            setAlertInfo({
                isOpen: true,
                title: "Sin Datos para Replicar",
                message: "Por favor, complete al menos la persona responsable, fecha o ámbito en el primer elemento antes de replicar."
            });
            return;
        }

        setEditableObligations(prev =>
            prev.map(ob => {
                if (ob.selected && ob.id !== sourceId) {
                    return { ...ob, responsible_area_id, responsible_person_id, due_date, scope };
                }
                return ob;
            })
        );
    };

    const handleOpenReviewModal = () => {
        handleCloseAlert();
        const obligationsToCreate = editableObligations.filter(ob => ob.selected);
    
        if (obligationsToCreate.length === 0) {
            setAlertInfo({ isOpen: true, title: 'Sin Tareas Seleccionadas', message: 'Por favor, seleccione al menos un elemento para crear tareas.' });
            return;
        }
    
        const invalidObligation = obligationsToCreate.find(
            ob => !ob.responsible_person_id || !ob.responsible_area_id || !ob.due_date || (ob.scope.level !== 'Institución' && ob.scope.entities.length === 0)
        );
    
        if (invalidObligation) {
            const missingData = [];
            if (!invalidObligation.responsible_area_id) missingData.push('"Área Responsable"');
            if (!invalidObligation.responsible_person_id) missingData.push('"Persona Responsable"');
            if (!invalidObligation.due_date) missingData.push('"Fecha Compromiso"');
            if (invalidObligation.scope.level !== 'Institución' && invalidObligation.scope.entities.length === 0) missingData.push(`"Entidades de ${invalidObligation.scope.level}"`);
            
            setAlertInfo({
                isOpen: true, title: 'Datos Incompletos',
                message: `Por favor, complete los campos ${missingData.join(', ')} para: "${(invalidObligation.obligation || 'Nuevo elemento').substring(0, 50)}..."`
            });
            return;
        }
        
        const newTasksToReview = obligationsToCreate.flatMap(ob => {
            const baseTask = {
               description: ob.obligation,
               responsible_area_id: ob.responsible_area_id!,
               responsible_person_id: ob.responsible_person_id!,
               documents: ob.documents.filter(d => d.selected).map(d => d.name),
            };

            if (ob.scope.level === 'Institución' || ob.scope.entities.length === 0) {
                return [{ ...baseTask, scope: { level: 'Institución', entity: 'Global', category: ob.category, source: ob.source, due_date: ob.due_date } }];
            }

            return ob.scope.entities.map(entity => ({
                ...baseTask,
                scope: {
                    level: ob.scope.level,
                    entity: entity,
                    category: ob.category,
                    source: ob.source,
                    due_date: ob.due_date,
                },
            }));
        });
    
        setTasksToReview(newTasksToReview as any);
        setIsReviewModalOpen(true);
    };

        const [projects, setProjects] = React.useState<{ id: string; name: string }[]>([]);
        const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);

        React.useEffect(() => {
            (async () => {
                try {
                    const { data, error } = await supabase.from('projects' as any).select('id, name').order('name');
                    if (!error && Array.isArray(data)) {
                        setProjects(data as any);
                    }
                } catch { /* opcional */ }
            })();
        }, []);

        const handleSaveFinalTasks = async (finalTasks: Omit<Task, 'id'|'created_at'|'subTasks'|'responsible_area'|'responsible_person'>[]) => {
        const user = await supabase.auth.getUser();
        const userId = user.data.user?.id;
        if (!userId) {
            setAlertInfo({isOpen:true,title:'Sesión requerida',message:'Inicie sesión nuevamente antes de crear tareas.'});
            return;
        }
        // Enriquecer tareas con campos obligatorios para políticas RLS
                // La tabla correcta según el schema tipado es 'institution_profile'
                // Modelo simple sin proyectos: se omite project_id
                const enriched = (finalTasks as any[]).map(t => {
                        const docs = Array.isArray(t.documents) ? t.documents : [];
                        return {
                          // project_id opcional para modo multi-proyecto
                          title: t.description?.slice(0,120) || 'Tarea',
                          description: t.description,
                          status: 'todo',
                          owner_id: userId,
                          responsible_area_id: t.responsible_area_id,
                          responsible_person_id: t.responsible_person_id,
                          due_date: (t.scope as any)?.due_date || (t as any).due_date || null,
                          scope: t.scope ? t.scope : null,
                          project_id: selectedProjectId || null,
                          documents: docs
                        };
                });
                console.debug('[tasks] Inserción preparada', enriched);
    const { error } = await supabase.from('tasks').insert(enriched);
        if (error) {
            console.error('Error creating tasks:', error, { enrichedSample: enriched[0] });
            setAlertInfo({isOpen: true, title: 'Error al Guardar', message: `No se pudieron crear las tareas. ${error.message}. Código: ${error.code}`});
        } else {
            setIsReviewModalOpen(false);
            setTasksToReview([]);
            setAiResponse(null);
            setEditableObligations([]);
            setQuery('');
            handleCloseAlert();
            setActiveView('tareas');
        }
    };

    const [temperature, setTemperature] = useState<number>(0.4);

    const handleSearch = async () => {
        if (!query.trim()) {
            setAlertInfo({ isOpen: true, title: 'Consulta Vacía', message: 'Por favor, ingrese su consulta para realizar el análisis.' });
            return;
        }
        setIsLoading(true);
        handleCloseAlert();
        setAiResponse(null);
        setEditableObligations([]);
        try {
            const response = await getComplianceAnalysis(query, temperature);
            setAiResponse(response);
            
            const commonInitialState = {
                selected: true,
                responsible_area_id: null,
                responsible_person_id: null,
                due_date: '',
                scope: { level: 'Institución' as ScopeLevel, entities: [] },
            };

            const obligationsAsTasks: EditableAiObligation[] = response.obligations.map((ob, index) => ({
                ...ob,
                ...commonInitialState,
                id: `ob-${Date.now()}-${index}`,
                documents: (ob.requiredDocuments || []).map(docName => ({ name: docName, selected: true })),
            }));

            const recommendationsAsTasks: EditableAiObligation[] = response.recommendations.map((rec, index) => ({
                id: `rec-${Date.now()}-${index}`,
                obligation: rec,
                source: 'Recomendación de IA',
                category: 'Recomendación',
                ...commonInitialState,
                documents: [],
            }));

            setEditableObligations([...obligationsAsTasks, ...recommendationsAsTasks]);

        } catch (err) {
            setAlertInfo({ isOpen: true, title: 'Error en el Análisis', message: err instanceof Error ? err.message : 'Ocurrió un error inesperado.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Encabezado principal mejorado */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-50 drop-shadow-sm">
                    <span className="bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent bg-clip-text text-transparent">Catálogo y Análisis Normativo</span>
                </h1>
                <p className="mt-2 text-slate-300 max-w-3xl leading-relaxed">
                    Consulte el marco normativo institucional y utilice el asistente de IA para convertir obligaciones y recomendaciones en tareas accionables.
                </p>
                {projects.length > 0 && (
                    <div className="mt-6 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
                        <div className="flex flex-col w-full max-w-sm">
                            <label htmlFor="project-select" className="text-sm font-semibold text-slate-200 mb-1 tracking-wide">Proyecto destino para nuevas tareas</label>
                            <select
                                id="project-select"
                                className="rounded-lg px-3 py-2 text-sm bg-slate-800/70 text-slate-100 placeholder:text-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary shadow-inner backdrop-blur-md transition-colors"
                                value={selectedProjectId || ''}
                                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                            >
                                <option value="">(Sin proyecto)</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1">Las tareas creadas se asociarán a este proyecto.</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-slate-600/40 ring-1 ring-black/30">
                <label htmlFor="ai-search" className="block text-lg font-bold text-slate-100 mb-2 tracking-tight">Asistente de Cumplimiento con IA</label>
                <p className="text-sm text-slate-300/90 mb-4 leading-relaxed">
                    Escriba una consulta en lenguaje natural. Ej: <span className="italic opacity-90">“¿Qué necesito para un laboratorio de química en preparatoria?”</span>
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        id="ai-search"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
                        placeholder="Escriba su consulta aquí..."
                        className="flex-grow p-3 rounded-lg bg-slate-900/60 border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary transition shadow-inner"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center disabled:from-slate-500 disabled:to-slate-500 disabled:cursor-not-allowed shadow"
                    >
                        {isLoading ? (
                           <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             Analizando...
                           </>
                        ) : 'Buscar'}
                    </button>
                </div>
                                                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/60">
                                    <div className="flex-1">
                                                        <label htmlFor="temperature" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-300 mb-1">Temperatura (creatividad)</label>
                                        <input
                                            id="temperature"
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            value={temperature}
                                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                                            className="w-full accent-brand-secondary cursor-pointer"
                                        />
                                    </div>
                                    <div className="w-28 text-center">
                                                        <span className="text-sm font-semibold text-slate-100">{temperature.toFixed(2)}</span>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">0=Determinista 1=Creativo</p>
                                    </div>
                                                    <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                                        <span>Sugerido: 0.3–0.6</span>
                                        <span className="hidden sm:inline">Ajuste según necesidad de exploración.</span>
                                    </div>
                                </div>
                                                 <p className="text-[11px] text-slate-400 mt-3">
                                                        *El asistente de IA es una herramienta de apoyo. Verifique siempre la información con las fuentes oficiales.
                                                </p>
            </div>

            {isLoading && <LoadingSpinner />}
            {aiResponse && (
                 <AiResultDisplay
                    summary={aiResponse.summary}
                    obligations={editableObligations}
                    onObligationChange={handleObligationChange}
                    onScopeChange={handleScopeChange}
                    onDocumentSelectionChange={handleDocumentSelectionChange}
                    responsibleAreas={responsibleAreas}
                    onAddResponsibleArea={handleAddResponsibleArea}
                    responsiblePersons={responsiblePersons}
                    onAddObligation={handleAddObligation}
                    onCreateTasks={handleOpenReviewModal}
                    onReplicateData={handleReplicateData}
                    scopeOptions={dynamicScopeOptions}
                />
            )}

            {isReviewModalOpen && (
                <TasksReviewModal
                    isOpen={isReviewModalOpen}
                    onClose={() => setIsReviewModalOpen(false)}
                    onSave={handleSaveFinalTasks}
                    initialTasks={tasksToReview}
                    availableAreas={responsibleAreas}
                    availablePersons={responsiblePersons}
                />
            )}

            {/* Eliminado selector flotante fijo; ahora integrado arriba */}

            <AlertModal 
                isOpen={alertInfo.isOpen}
                onClose={handleCloseAlert}
                title={alertInfo.title}
                message={alertInfo.message}
            />
        </div>
    );
};

export default NormativasView;