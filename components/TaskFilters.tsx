import React from 'react';
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
        <label className="text-sm font-medium text-slate-600">{label}</label>
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
    
    const inputBaseClasses = "w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors duration-200 ease-in-out";
    
    const selectArrowStyle = {
        backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
        paddingRight: '2.5rem'
    };

    return (
        <div className="bg-white p-5 rounded-xl shadow-lg mb-8 border border-slate-200">
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
                    <select name="status" value={filters.status} onChange={handleInputChange} className={`${inputBaseClasses} appearance-none`} style={selectArrowStyle}>
                       <option value="Todos">Todos</option>
                       <option value="Atrasada">Atrasada</option>
                       <option value="Pendiente">Pendiente</option>
                       <option value="En Progreso">En Progreso</option>
                       <option value="Completada">Completada</option>
                    </select>
                </FilterInputWrapper>

                {/* Scope Level */}
                <FilterInputWrapper label="Nivel de Ámbito">
                    <select name="scopeLevel" value={filters.scopeLevel} onChange={handleInputChange} className={`${inputBaseClasses} appearance-none`} style={selectArrowStyle}>
                       {availableScopeLevels.map(level => <option key={level} value={level}>{level === 'Todos' ? 'Todos los Niveles' : level}</option>)}
                    </select>
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
                    <select name="category" value={filters.category} onChange={handleInputChange} className={`${inputBaseClasses} appearance-none`} style={selectArrowStyle}>
                        {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </FilterInputWrapper>
                
                 {/* Area Filter */}
                <FilterInputWrapper label="Área Responsable">
                    <select name="responsibleArea" value={filters.responsibleArea} onChange={handleInputChange} className={`${inputBaseClasses} appearance-none`} style={selectArrowStyle}>
                         <option value="Todos">Todas</option>
                         {availableAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                </FilterInputWrapper>
                
                 {/* Person Filter */}
                <FilterInputWrapper label="Persona Responsable">
                    <select name="responsiblePerson" value={filters.responsiblePerson} onChange={handleInputChange} className={`${inputBaseClasses} appearance-none`} style={selectArrowStyle}>
                       <option value="Todos">Todas</option>
                       {availablePersons.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
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
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                    <XCircleIcon className="w-5 h-5"/>
                    <span>Limpiar Filtros</span>
                </button>
            </div>
        </div>
    );
};

export default TaskFilters;