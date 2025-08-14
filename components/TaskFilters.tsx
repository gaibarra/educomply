import React from 'react';
import EnhancedSelect from './EnhancedSelect';
import { TaskFilters as TaskFiltersType, ScopeLevel } from '../types';
import FilterIcon from './icons/FilterIcon';
import XCircleIcon from './icons/XCircleIcon';
import CalendarIcon from './icons/CalendarIcon';

interface TaskFiltersProps {
    filters: TaskFiltersType;
    onFiltersChange: React.Dispatch<React.SetStateAction<TaskFiltersType>>;
    onClearFilters: () => void;
    availableCategories: string[];
    availableAreas: { id: string; name: string }[];
    availablePersons: { id: string; name: string }[];
    availableScopeLevels: ('Todos' | ScopeLevel)[];
}

const FilterInputWrapper: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
    <div className="flex flex-col gap-1.5 w-full">
        <label className="text-xs font-semibold tracking-wide uppercase text-slate-200/80">{label}</label>
        {children}
    </div>
);

const TaskFilters: React.FC<TaskFiltersProps> = ({
    filters,
    onFiltersChange,
    onClearFilters,
    availableCategories,
    availableAreas,
    availablePersons,
    availableScopeLevels,
}) => {

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        onFiltersChange(prev => ({ ...prev, [name]: value }));
    };
    
    const inputBaseClasses = "w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-slate-100 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 ease-in-out";
    
    // selectArrowStyle removed (replaced by EnhancedSelect)

    return (
    <div className="glass p-5 rounded-xl shadow-lg mb-8 border border-white/10">
            <div className="flex items-center gap-3 mb-5">
                <FilterIcon className="w-6 h-6 text-brand-primary"/>
                <h3 className="text-xl font-bold text-brand-primary">Filtros de Búsqueda</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-5">
                {/* Keyword Search */}
                <FilterInputWrapper label="Palabra Clave">
                    <input
                        type="text"
                        name="keyword"
                        placeholder="Buscar en obligación o fuente..."
                        value={filters.keyword}
                        onChange={handleInputChange}
                        className={inputBaseClasses}
                    />
                </FilterInputWrapper>
                
                {/* Status Filter */}
                <FilterInputWrapper label="Estado">
                    <EnhancedSelect
                        value={filters.status === 'Todos' ? '' : filters.status}
                        onChange={(v)=> onFiltersChange(prev=>({...prev, status: v || 'Todos'}))}
                        options={[{value:'',label:'Todos'},'Atrasada','Pendiente','En Progreso','Completada'].map(v=> typeof v==='string'? { value:v, label: v||'Todos'}: v)}
                        placeholder="Todos"
                        className="bg-transparent"
                    />
                </FilterInputWrapper>

                {/* Scope Level */}
                <FilterInputWrapper label="Nivel de Ámbito">
                    <EnhancedSelect
                        value={filters.scopeLevel === 'Todos'? '' : (filters.scopeLevel as string)}
                        onChange={(v)=> onFiltersChange(prev=>({...prev, scopeLevel: (v || 'Todos') as any}))}
                        options={availableScopeLevels.map(l=> ({ value: l==='Todos'? '': l, label: l==='Todos'? 'Todos los Niveles': l }))}
                        placeholder="Todos los Niveles"
                    />
                </FilterInputWrapper>

                {/* Scope Entity */}
                 <FilterInputWrapper label="Entidad Específica">
                    <input
                        type="text"
                        name="scopeEntity"
                        placeholder="Ej: Campus Norte, Primaria..."
                        value={filters.scopeEntity}
                        onChange={handleInputChange}
                        className={inputBaseClasses}
                        disabled={filters.scopeLevel === 'Todos'}
                    />
                </FilterInputWrapper>
                
                {/* Category Filter */}
                <FilterInputWrapper label="Categoría">
                    <EnhancedSelect
                        value={filters.category}
                        onChange={(v)=> onFiltersChange(prev=>({...prev, category: v || ''}))}
                        options={availableCategories.map(cat=> ({ value: cat, label: cat }))}
                        placeholder="Todas"
                    />
                </FilterInputWrapper>
                
                 {/* Area Filter */}
                <FilterInputWrapper label="Área Responsable">
                    <EnhancedSelect
                        value={filters.responsibleArea === 'Todos'? '' : filters.responsibleArea}
                        onChange={(v)=> onFiltersChange(prev=>({...prev, responsibleArea: v || 'Todos'}))}
                        options={[{value:'',label:'Todas'}, ...availableAreas.map(a=>({ value:a.id, label:a.name }))]}
                        placeholder="Todas"
                    />
                </FilterInputWrapper>
                
                 {/* Person Filter */}
                <FilterInputWrapper label="Persona Responsable">
                    <EnhancedSelect
                        value={filters.responsiblePerson === 'Todos'? '' : filters.responsiblePerson}
                        onChange={(v)=> onFiltersChange(prev=>({...prev, responsiblePerson: v || 'Todos'}))}
                        options={[{value:'',label:'Todas'}, ...availablePersons.map(p=>({ value:p.id, label:p.name }))]}
                        placeholder="Todas"
                    />
                </FilterInputWrapper>
                
                {/* Date Range Start */}
                <FilterInputWrapper label="Vencimiento Desde">
                    <div className="relative">
                        <input
                            type="date"
                            name="dueDateStart"
                            value={filters.dueDateStart}
                            onChange={handleInputChange}
                            className={`${inputBaseClasses} pr-10`}
                        />
                         <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <CalendarIcon className="h-5 w-5 text-slate-400" />
                        </div>
                    </div>
                </FilterInputWrapper>

                {/* Date Range End */}
                <FilterInputWrapper label="Vencimiento Hasta">
                     <div className="relative">
                        <input
                            type="date"
                            name="dueDateEnd"
                            value={filters.dueDateEnd}
                            onChange={handleInputChange}
                            className={`${inputBaseClasses} pr-10`}
                        />
                         <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <CalendarIcon className="h-5 w-5 text-slate-400" />
                        </div>
                    </div>
                </FilterInputWrapper>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                 <button 
                    onClick={onClearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-100 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                    <XCircleIcon className="w-5 h-5"/>
                    <span>Limpiar Filtros</span>
                </button>
            </div>
        </div>
    );
};

export default TaskFilters;