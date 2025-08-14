

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { supabase } from '../services/supabaseClient';
import { Task, TaskOverallStatus, TaskFilters as TaskFiltersType, ScopeLevel, Profile, ResponsibleArea, SubTask, TaskScope, TaskComment, AttachedDocument, TaskFromDb, Database } from '../types';
import TaskCard from './TaskCard';
import TaskFilters from './TaskFilters';

const getTaskStatus = (task: Task): TaskOverallStatus => {
    // Si no hay subtareas, el estado se basa solo en la fecha.
    const dueDateStr = task.scope?.due_date;

    if (!task.subTasks || task.subTasks.length === 0) {
        if (!dueDateStr) return 'Pendiente';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        return dueDate < today ? 'Atrasada' : 'Pendiente';
    }

    const completedSubTasks = task.subTasks.filter(st => st.status === 'Completada').length;
    const progress = (completedSubTasks / task.subTasks.length) * 100;
    
    if (progress === 100) {
        return 'Completada';
    }

    if (dueDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        if (dueDate < today) {
            return 'Atrasada';
        }
    }
    
    if (progress > 0) {
        return 'En Progreso';
    }
    return 'Pendiente';
};

const TareasView: React.FC<{ profile: Profile; initialKeyword?: string }> = ({ profile, initialKeyword = '' }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | 'Todos'>('Todos');
    // Toggle sólo visible para admin: ver todas las tareas o sólo propias / asignadas
    const [showAllForAdmin, setShowAllForAdmin] = useState(false);

    const initialFilters: TaskFiltersType = {
        keyword: initialKeyword || '', category: 'Todos', responsibleArea: 'Todos',
        responsiblePerson: 'Todos', status: 'Todos', dueDateStart: '',
        dueDateEnd: '', scopeLevel: 'Todos', scopeEntity: '',
    };
    
    const [filters, setFilters] = useState<TaskFiltersType>(initialFilters);
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
    const hasFocusedRef = useRef(false);

    // If initialKeyword changes (e.g., coming from Gantt), update filters once.
    // Detect navigation source: if arrived via sidebar (no keyword param change), avoid auto scroll
    const viaSidebarRef = useRef(false);
    useEffect(()=>{
        const listener = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            if(detail.view === 'tareas' && !detail.q) {
                viaSidebarRef.current = true;
            }
        };
        window.addEventListener('app:navigate', listener as EventListener);
        return ()=> window.removeEventListener('app:navigate', listener as EventListener);
    },[]);
    useEffect(() => {
        if (initialKeyword) {
            setFilters(prev => ({ ...prev, keyword: initialKeyword }));
        }
        // reset flag if keyword present
        if(initialKeyword) viaSidebarRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialKeyword]);
    
    const [availableFilterOptions, setAvailableFilterOptions] = useState<{
        categories: string[];
        areas: ResponsibleArea[];
        persons: Profile[];
        scopeLevels: ('Todos' | ScopeLevel)[];
    }>({ categories: [], areas: [], persons: [], scopeLevels: ['Todos', 'Institución', 'Campus', 'Nivel Educativo', 'Facultad/Escuela'] });

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Step 1: Build the main task query based on filters
            let tasksQuery = supabase
                .from('tasks')
                .select(`id, created_at, description, scope, documents, responsible_area_id, responsible_person_id, owner_id, project_id, completed_by, completed_at, completed_by_profile:completed_by ( id, full_name, role, scope_entity )`)
                .order('scope->>due_date' as any, { ascending: true });

            if (selectedProjectId !== 'Todos') {
                tasksQuery = tasksQuery.eq('project_id', selectedProjectId);
            }

            const restrictToUser = profile.role !== 'admin' || !showAllForAdmin; // si no es admin o admin con toggle apagado
            if (restrictToUser) {
                tasksQuery = tasksQuery.or(`owner_id.eq.${profile.id},responsible_person_id.eq.${profile.id}`);
            }
    
            if (filters.keyword) tasksQuery = tasksQuery.ilike('description', `%${filters.keyword}%`);
            if (filters.category !== 'Todos') tasksQuery = tasksQuery.eq('scope->>category', filters.category);
            if (filters.responsibleArea !== 'Todos') tasksQuery = tasksQuery.eq('responsible_area_id', filters.responsibleArea);
            if (filters.responsiblePerson !== 'Todos') tasksQuery = tasksQuery.eq('responsible_person_id', filters.responsiblePerson);
            if (filters.dueDateStart) tasksQuery = tasksQuery.gte('scope->>due_date', filters.dueDateStart);
            if (filters.dueDateEnd) tasksQuery = tasksQuery.lte('scope->>due_date', filters.dueDateEnd);
            if (filters.scopeLevel !== 'Todos') tasksQuery = tasksQuery.eq('scope->>level', filters.scopeLevel);
            if (filters.scopeEntity && filters.scopeLevel !== 'Todos') tasksQuery = tasksQuery.ilike('scope->>entity', `%${filters.scopeEntity}%`);
    
            const { data: tasksData, error: tasksError } = await tasksQuery;
            if (tasksError) throw tasksError;
    
            const tasksWithoutRelations = tasksData as unknown as TaskFromDb[];
            if (!tasksWithoutRelations || tasksWithoutRelations.length === 0) {
                setTasks([]);
                setLoading(false);
                return;
            }

            const taskIds = tasksWithoutRelations.map(t => t.id);
            const areaIds = [...new Set(tasksWithoutRelations.map(t => t.responsible_area_id).filter(Boolean))];
            const personIdsFromTasks = tasksWithoutRelations.map(t => t.responsible_person_id).filter(Boolean);

            // Step 2: Fetch all related data in parallel
            const { data: subTasksData, error: subTasksError } = await supabase.from('sub_tasks').select('*').in('task_id', taskIds);
            if (subTasksError) throw subTasksError;
            
            const allSubTasks = subTasksData as unknown as Database['public']['Tables']['sub_tasks']['Row'][];
            const subTaskIds = allSubTasks.map(st => st.id);
            const personIdsFromSubTasks = allSubTasks.map(st => st.assigned_to_id).filter(Boolean);
            const allPersonIds = [...new Set([...personIdsFromTasks, ...personIdsFromSubTasks])];

            const [
                { data: commentsData, error: commentsError },
                { data: documentsData, error: documentsError },
                { data: areasData, error: areasError },
                { data: personsData, error: personsError }
            ] = await Promise.all([
                subTaskIds.length > 0 ? supabase.from('comments').select(`*`).in('sub_task_id', subTaskIds) : Promise.resolve({ data: [], error: null }),
                subTaskIds.length > 0 ? supabase.from('documents').select(`*`).in('sub_task_id', subTaskIds) : Promise.resolve({ data: [], error: null }),
                areaIds.length > 0 ? supabase.from('responsible_areas').select('id, name').in('id', areaIds) : Promise.resolve({ data: [], error: null }),
                allPersonIds.length > 0 ? supabase.from('profiles').select('id, full_name, role, scope_entity').in('id', allPersonIds) : Promise.resolve({ data: [], error: null })
            ]);
    
            if (commentsError) throw commentsError;
            if (documentsError) throw documentsError;
            if (areasError) throw areasError;
            if (personsError) throw personsError;

            const typedCommentsData = commentsData as unknown as TaskComment[];
            const typedDocumentsData = documentsData as unknown as AttachedDocument[];
            const typedAreasData = areasData as unknown as ResponsibleArea[];
            const typedPersonsData = personsData as unknown as Profile[];

            // Step 3: Create lookup maps for efficient data assembly
            const commentsBySubTaskId = (typedCommentsData || []).reduce((acc, comment) => {
                (acc[comment.sub_task_id] = acc[comment.sub_task_id] || []).push(comment);
                return acc;
            }, {} as Record<string, TaskComment[]>);

            const documentsBySubTaskId = (typedDocumentsData || []).reduce((acc, doc) => {
                (acc[doc.sub_task_id] = acc[doc.sub_task_id] || []).push(doc);
                return acc;
            }, {} as Record<string, AttachedDocument[]>);

            const personsById = new Map((typedPersonsData || []).map(p => [p.id, p]));
            const areasById = new Map((typedAreasData || []).map(a => [a.id, a]));

            const subTasksByTaskId = (allSubTasks || []).reduce((acc, st) => {
                const enrichedSubTask: SubTask = {
                    ...st,
                    comments: commentsBySubTaskId[st.id] || [],
                    documents: documentsBySubTaskId[st.id] || [],
                    assigned_to: st.assigned_to_id ? personsById.get(st.assigned_to_id) || null : null
                };
                (acc[st.task_id] = acc[st.task_id] || []).push(enrichedSubTask);
                return acc;
            }, {} as Record<string, SubTask[]>);
    
            // Step 4: Combine all data into final Task objects
            let finalTasks: Task[] = (tasksWithoutRelations || []).map(task => ({
                ...task,
                scope: task.scope,
                responsible_area: task.responsible_area_id ? areasById.get(task.responsible_area_id) || null : null,
                responsible_person: task.responsible_person_id ? personsById.get(task.responsible_person_id) || null : null,
                subTasks: subTasksByTaskId[task.id] || [],
                completed_by: (task as any).completed_by || null,
                completed_at: (task as any).completed_at || null,
                completed_by_profile: (task as any).completed_by_profile || null,
            }));
    
            // Post-filter for computed status, as this can't be done in the DB query
            if (filters.status !== 'Todos') {
                finalTasks = finalTasks.filter(task => getTaskStatus(task) === filters.status);
            }
    
            setTasks(finalTasks);
    
        } catch (err: any) {
            console.error("Error fetching tasks:", err);
            if (err.code === '42P17' || (err.message && String(err.message).includes('infinite recursion'))) {
                 setError("Error de Configuración (Recursión Infinita): No se pudieron cargar las tareas debido a un problema de seguridad en la base de datos (RLS). Por favor, contacte a un administrador.");
            } else {
                 setError(`Error al cargar las tareas: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [filters, profile.id, profile.role, showAllForAdmin, selectedProjectId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // After tasks load, if there's an initial keyword, scroll to the first matching task and highlight it briefly
    useEffect(() => {
        if (loading || error) return;
        if (!initialKeyword || hasFocusedRef.current) return;
        if (!tasks || tasks.length === 0) return;
        if (viaSidebarRef.current) return; // skip auto scroll when opened from sidebar
        const kw = initialKeyword.toLowerCase();
        const match = tasks.find(t => (t.description || '').toLowerCase().includes(kw));
        if (match) {
            const el = document.getElementById(`task-${match.id}`);
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setHighlightedTaskId(match.id);
            setTimeout(() => setHighlightedTaskId(null), 2500);
            hasFocusedRef.current = true;
        }
    }, [loading, error, tasks, initialKeyword]);
    
    useEffect(() => {
        // Fetch options for filters
        const fetchOptions = async () => {
            try {
                const [
                  { data: areasData, error: areasError },
                  { data: personsData, error: personsError },
                  { data: tasksWithScopeData, error: categoriesError },
                  { data: projectsData, error: projectsError }
                ] = await Promise.all([
                   supabase.from('responsible_areas').select('id, name').order('name'),
                   supabase.from('profiles').select('id, full_name, role, scope_entity').order('full_name'),
                   supabase.from('tasks').select('scope'),
                   supabase.from('projects' as any).select('id, name').order('name')
                ]);

                if (areasError) throw areasError;
                if (personsError) throw personsError;
                if (categoriesError) throw categoriesError;
                if (projectsError) {
                    // If projects table not present or blocked by RLS, ignore silently
                    console.warn('No se pudo cargar proyectos para filtro (opcional):', projectsError.message);
                }

                const typedAreasData = areasData as unknown as ResponsibleArea[];
                const typedPersonsData = personsData as unknown as Profile[];
                const typedTasksWithScope = tasksWithScopeData as unknown as { scope: TaskScope | null }[];

                const categories = new Set<string>();
                (typedTasksWithScope || []).forEach(task => {
                    const scope = task.scope;
                    if (scope && scope.category) {
                        categories.add(scope.category);
                    }
                });

                setAvailableFilterOptions(prev => ({
                    ...prev,
                    areas: typedAreasData || [],
                    persons: typedPersonsData || [],
                    categories: ['Todos', ...Array.from(categories).sort()]
                }));

                setProjects(((projectsData as any[]) || []).map(p => ({ id: p.id, name: p.name })));
            } catch (error) {
                 console.error("Error fetching filter options", error);
                 // Optionally set an error state for the UI
            }
        };
        fetchOptions();
    }, []);

    const handleUpdateTask = (updatedTask: Task) => {
        setTasks(prevTasks => prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    };

    const availableTeamMembers = useMemo(() => availableFilterOptions.persons, [availableFilterOptions.persons]);
    
    return (
        <div className="p-6 md:p-8">
            <h2 className="text-3xl font-extrabold text-gradient mb-2">Gestión de Tareas</h2>
            <p className="text-slate-300 mb-6 max-w-3xl">Supervise, delegue y comente el progreso de las obligaciones de cumplimiento.</p>

            {profile.role === 'admin' && (
                <div className="mb-5 flex items-center gap-2 bg-white/5 rounded-lg px-4 py-2 border border-white/10 backdrop-blur">
                    <input
                        id="toggleAllTasks"
                        type="checkbox"
                        className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-slate-300 rounded"
                        checked={showAllForAdmin}
                        onChange={e => setShowAllForAdmin(e.target.checked)}
                    />
                    <label htmlFor="toggleAllTasks" className="text-sm text-slate-200 select-none">
                        Ver todas las tareas (Admin)
                    </label>
                    <span className="text-xs text-slate-400 ml-auto">
                        {showAllForAdmin ? 'Mostrando global' : 'Mostrando propias/asignadas'}
                    </span>
                </div>
            )}

            <TaskFilters 
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={() => setFilters(initialFilters)}
                availableCategories={availableFilterOptions.categories}
                availableAreas={availableFilterOptions.areas.map(a => ({ id: String(a.id), name: a.name }))}
                availablePersons={availableFilterOptions.persons.map(p => ({ id: p.id, name: p.full_name }))}
                availableScopeLevels={availableFilterOptions.scopeLevels}
            />
            {projects.length > 0 && (
                <div className="mb-6 flex items-center gap-2 bg-white/5 rounded-lg px-4 py-2 border border-white/10 backdrop-blur">
                    <label className="text-sm text-slate-200 select-none">Proyecto:</label>
                    <div className="w-64">
                        <EnhancedSelect
                            value={selectedProjectId === 'Todos' ? '' : selectedProjectId}
                            onChange={(v)=> setSelectedProjectId((v || 'Todos') as any)}
                            options={[{value:'',label:'Todos'}, ...projects.map(p=>({ value:p.id, label:p.name }))]}
                            placeholder="Todos"
                            searchable
                            clearable
                        />
                    </div>
                    <span className="text-xs text-slate-400 ml-auto">Filtro por proyecto (opcional)</span>
                </div>
            )}
            
            {loading && (
                <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            )}

            {!loading && error && (
                 <div className="bg-red-50 p-8 rounded-xl shadow-md text-center text-red-700">
                    <h3 className="mt-4 text-lg font-semibold">{error}</h3>
                </div>
            )}
            
            {!loading && !error && tasks.length === 0 && (
                <div className="glass p-8 rounded-xl shadow-md text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-semibold text-slate-700">No se encontraron tareas</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Intente ajustar los filtros o vaya a 'Normativas' para crear nuevas tareas.
                    </p>
                </div>
            )}

            {!loading && !error && tasks.length > 0 && (
                <div className="space-y-6 mt-6">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            id={`task-${task.id}`}
                            className={highlightedTaskId === task.id ? 'rounded-xl ring-2 ring-cyan-400/70 bg-white/5 transition duration-500' : ''}
                        >
                            <TaskCard 
                                task={task} 
                                onUpdateTask={handleUpdateTask} 
                                availableTeamMembers={availableTeamMembers}
                                currentUserProfile={profile}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TareasView;