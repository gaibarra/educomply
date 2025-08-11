import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

    const handleAreaSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>, obligationId: string) => {
        if (e.target.value === 'ADD_NEW_AREA') {
            setAddingAreaFor(obligationId);
            setNewAreaName('');
        } else {
            onObligationChange(obligationId, 'responsible_area_id', Number(e.target.value));
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
    <div className="mt-6 bg-white p-6 rounded-lg shadow-lg animate-fade-in">
        <h3 className="text-2xl font-bold text-brand-primary mb-4">Análisis de Cumplimiento por IA</h3>
        
        <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-brand-accent pb-2 mb-3">Resumen</h4>
            <p className="text-slate-600">{summary}</p>
        </div>

        <div className="mb-6">
            <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-brand-accent pb-2 mb-3">Obligaciones y Recomendaciones</h4>
            <p className="text-sm text-slate-500 mb-4">Seleccione los elementos, asigne responsables, fechas y el ámbito de aplicación. Estas acciones se convertirán en tareas de seguimiento.</p>
            <ul className="space-y-4">
                {obligations.map((item) => (
                    <li key={item.id} className={`bg-slate-50 p-4 rounded-lg border-l-4 transition-all duration-300 ${item.selected ? 'border-brand-secondary shadow-sm' : 'border-slate-200'}`}>
                        <div className="flex items-start gap-4">
                            <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => onObligationChange(item.id, 'selected', e.target.checked)}
                                className="mt-2 h-5 w-5 rounded border-gray-300 text-brand-secondary focus:ring-brand-secondary cursor-pointer"
                                aria-label={`Seleccionar obligación: ${item.obligation}`}
                            />

                            <div className="flex-1">
                                <textarea
                                    value={item.obligation}
                                    onChange={(e) => onObligationChange(item.id, 'obligation', e.target.value)}
                                    className={`w-full p-2 border rounded-md transition-all duration-200 text-base ${item.selected ? 'bg-white border-slate-300 text-slate-800 font-medium' : 'bg-transparent border-transparent text-slate-600'}`}
                                    rows={item.selected ? 2 : 1}
                                    disabled={!item.selected}
                                    aria-label="Descripción de la obligación"
                                    placeholder="Describa la obligación específica..."
                                />
                                
                                {!item.selected && (
                                    <div className="mt-2 text-sm text-slate-500 flex items-center gap-4 flex-wrap">
                                        <p><strong>Fuente:</strong> {item.source}</p>
                                        <span className='bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium'>{item.category}</span>
                                    </div>
                                )}
                                
                                {item.selected && (
                                     <div className="mt-4 space-y-4">
                                        {item.id === firstSelectedId && selectedCount > 1 && (
                                             <div className="p-2 bg-yellow-50 border border-dashed border-yellow-300 rounded-md transition-all animate-fade-in">
                                                 <button
                                                     onClick={() => onReplicateData(item.id)}
                                                     className="flex items-center gap-2.5 text-sm font-semibold text-yellow-800 hover:text-yellow-900 transition-colors w-full justify-center p-2 rounded-md hover:bg-yellow-100"
                                                 >
                                                     <SparklesIcon className="h-5 w-5 text-yellow-500"/>
                                                     <span>Replicar datos en los <strong>{selectedCount - 1}</strong> otros elementos seleccionados</span>
                                                 </button>
                                             </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 p-4 bg-white rounded-md border border-slate-200">
                                            {/* Fuente Legal */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`source-${item.id}`} className="text-sm font-medium text-slate-600">Fuente Legal</label>
                                                <input
                                                    id={`source-${item.id}`} type="text" value={item.source}
                                                    onChange={(e) => onObligationChange(item.id, 'source', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800"
                                                    placeholder="Ej: Ley General de Educación, Art. 15"
                                                />
                                            </div>
                                            {/* Categoría */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`cat-${item.id}`} className="text-sm font-medium text-slate-600">Categoría</label>
                                                <input
                                                    id={`cat-${item.id}`} type="text" value={item.category}
                                                    onChange={(e) => onObligationChange(item.id, 'category', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800"
                                                    placeholder="Ej: Laboral"
                                                />
                                            </div>
                                            {/* Fecha Compromiso */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`due-date-${item.id}`} className="text-sm font-medium text-slate-600">Fecha Compromiso</label>
                                                <div className="relative">
                                                    <input id={`due-date-${item.id}`} type="date" value={item.due_date} onChange={(e) => onObligationChange(item.id, 'due_date', e.target.value)} className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800 pr-9"/>
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                        <CalendarIcon className="h-5 w-5 text-slate-400" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Área Responsable */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`resp-${item.id}`} className="text-sm font-medium text-slate-600">Área Responsable</label>
                                                {addingAreaFor === item.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input type="text" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveNewArea(item.id)} className="flex-grow p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800" placeholder="Nueva área" autoFocus />
                                                        <button onClick={() => handleSaveNewArea(item.id)} className="p-2 bg-status-success text-white rounded-md hover:bg-green-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                                                        <button onClick={() => setAddingAreaFor(null)} className="p-2 bg-status-danger text-white rounded-md hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                    </div>
                                                ) : (
                                                    <select id={`resp-${item.id}`} value={item.responsible_area_id ?? ''} onChange={(e) => handleAreaSelectChange(e, item.id)} className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800">
                                                        <option value="">Sin asignar</option>
                                                        {responsibleAreas.map(area => (<option key={area.id} value={area.id} className="text-slate-800">{area.name}</option>))}
                                                        <option value="ADD_NEW_AREA" className="font-bold text-brand-secondary bg-slate-100 pt-2 mt-1 border-t">+ Agregar nueva área...</option>
                                                    </select>
                                                )}
                                            </div>
                                            {/* Persona Responsable */}
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor={`person-${item.id}`} className="text-sm font-medium text-slate-600">Persona Responsable</label>
                                                
                                                <select id={`person-${item.id}`} value={item.responsible_person_id ?? ''} onChange={(e) => onObligationChange(item.id, 'responsible_person_id', e.target.value)} className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800">
                                                    <option value="">Sin asignar</option>
                                                    {responsiblePersons.map(person => (<option key={person.id} value={person.id} className="text-slate-800">{person.full_name}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Ámbito de Aplicación */}
                                        <div className="p-4 bg-white rounded-md border border-slate-200">
                                            <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                <BuildingOfficeIcon className="w-5 h-5 text-brand-secondary"/>
                                                Ámbito de Aplicación
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor={`scope-level-${item.id}`} className="text-xs font-medium text-slate-500">Nivel</label>
                                                    <select
                                                        id={`scope-level-${item.id}`}
                                                        value={item.scope.level}
                                                        onChange={(e) => onScopeChange(item.id, { level: e.target.value as ScopeLevel, entities: [] })}
                                                        className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800"
                                                    >
                                                        <option value="Institución">Institución (Global)</option>
                                                        {(Object.keys(scopeOptions) as Array<keyof typeof scopeOptions>).map(level => (
                                                            <option key={level} value={level}>{level}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {item.scope.level !== 'Institución' && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label htmlFor={`scope-entities-${item.id}`} className="text-xs font-medium text-slate-500">
                                                            {item.scope.level} Específicos
                                                        </label>
                                                        <select
                                                            multiple
                                                            id={`scope-entities-${item.id}`}
                                                            value={item.scope.entities}
                                                            onChange={(e) => {
                                                                const selected = Array.from((e.target as HTMLSelectElement).selectedOptions, option => (option as HTMLOptionElement).value);
                                                                onScopeChange(item.id, { ...item.scope, entities: selected });
                                                            }}
                                                            className="w-full p-2 border rounded-md text-sm bg-white border-slate-300 text-slate-800 h-24"
                                                        >
                                                            {(scopeOptions[item.scope.level as keyof typeof scopeOptions] || []).map(entity => (
                                                                <option key={entity} value={entity}>{entity}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-400">Mantenga Ctrl/Cmd para seleccionar varios.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Documentos Sugeridos */}
                                        {item.documents && item.documents.length > 0 && (
                                            <div className="p-4 bg-white rounded-md border border-slate-200">
                                                <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
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
                                                                className="h-4 w-4 rounded border-gray-300 text-brand-secondary focus:ring-brand-secondary cursor-pointer"
                                                                aria-label={`Seleccionar documento: ${doc.name}`}
                                                            />
                                                            <label htmlFor={`doc-${item.id}-${doc.name}`} className="text-sm text-slate-600 cursor-pointer">
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
             <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                    onClick={onAddObligation}
                    className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors"
                >
                    <PlusCircleIcon className="h-5 w-5"/>
                    Agregar Obligación Manualmente
                </button>
            </div>
        </div>
        
         <div className="mt-8 text-right">
            <button
                onClick={onCreateTasks}
                disabled={selectedCount === 0}
                className="bg-brand-secondary text-white font-bold py-3 px-6 sm:px-8 rounded-lg hover:bg-brand-primary focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 text-base sm:text-lg shadow-lg hover:shadow-xl disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
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
                          // project_id eliminado del modelo simple
                          title: t.description?.slice(0,120) || 'Tarea',
                          description: t.description,
                          status: 'todo',
                          owner_id: userId,
                          responsible_area_id: t.responsible_area_id,
                          responsible_person_id: t.responsible_person_id,
                          due_date: (t.scope as any)?.due_date || (t as any).due_date || null,
                          scope: t.scope ? t.scope : null,
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
            const response = await getComplianceAnalysis(query);
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
        <div className="p-6 md:p-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Catálogo y Análisis Normativo</h2>
            <p className="text-slate-500 mb-6">Consulte el marco normativo y utilice el asistente de IA para análisis contextual.</p>

            <div className="bg-white p-6 rounded-xl shadow-md">
                <label htmlFor="ai-search" className="block text-lg font-semibold text-slate-700 mb-2">Asistente de Cumplimiento con IA</label>
                <p className="text-sm text-slate-500 mb-4">
                    Haga una pregunta en lenguaje natural. Ej: "¿Qué necesito para un laboratorio de química en preparatoria?"
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        id="ai-search"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
                        placeholder="Escriba su consulta aquí..."
                        className="flex-grow p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="bg-brand-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-all duration-300 flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed"
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
                 <p className="text-xs text-slate-400 mt-2">
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