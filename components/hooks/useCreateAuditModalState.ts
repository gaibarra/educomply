import { useReducer, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Profile, ScopeLevel, InstitutionProfileRow } from '../../types';
import { EnhancedSelectOption } from '../../components/EnhancedSelect';

// 1. State, Action, Reducer
interface State {
  name: string;
  auditorId: string | null;
  startDate: string;
  endDate: string;
  scopeLevel: ScopeLevel | 'General';
  scopeEntity: string;
  error: string | null;
  isSaving: boolean;
  projects: { id: string; name: string }[];
  selectedProjectId: string | null;
  validationErrors: Record<string, string>;
}

type Action =
  | { type: 'SET_FIELD'; field: keyof State; payload: any }
  | { type: 'RESET_FORM' }
  | { type: 'SET_VALIDATION_ERRORS'; payload: Record<string, string> };

const initialState: State = {
  name: '',
  auditorId: null,
  startDate: '',
  endDate: '',
  scopeLevel: 'General',
  scopeEntity: '',
  error: null,
  isSaving: false,
  projects: [],
  selectedProjectId: null,
  validationErrors: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.payload };
    case 'RESET_FORM':
      return { ...initialState, projects: state.projects }; // Preserve projects
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };
    default:
      return state;
  }
}

// 2. Hook
interface UseCreateAuditModalStateProps {
  isOpen: boolean;
  auditors: Profile[];
  institutionProfile: InstitutionProfileRow | null;
}

export function useCreateAuditModalState({ isOpen, auditors, institutionProfile }: UseCreateAuditModalStateProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { name, auditorId, startDate, endDate, scopeLevel, scopeEntity } = state;

  const dynamicScopeOptions = useMemo(() => {
    if (!institutionProfile) return { 'Campus': [], 'Nivel Educativo': [], 'Facultad/Escuela': [] };
    const faculties = [...new Set(institutionProfile.academic_programs.map(p => p.faculty).filter(Boolean))];
    return {
      'Campus': institutionProfile.locations.map(l => l.name),
      'Nivel Educativo': institutionProfile.educational_levels,
      'Facultad/Escuela': faculties,
    };
  }, [institutionProfile]);

  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET_FORM' });
      const loadProjects = async () => {
        const { data, error } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false });
        if (!error && data) {
          dispatch({ type: 'SET_FIELD', field: 'projects', payload: data });
        }
      };
      loadProjects();
    }
  }, [isOpen]);

  const auditorOptions: EnhancedSelectOption[] = useMemo(() => auditors.map(a => ({ value: a.id, label: a.full_name })), [auditors]);
  const projectOptions: EnhancedSelectOption[] = useMemo(() => state.projects.map(p => ({ value: p.id, label: p.name })), [state.projects]);
  const scopeLevelOptions: EnhancedSelectOption[] = useMemo(() => [
    { value: 'General', label: 'General (Toda la Institución)' },
    ...Object.keys(dynamicScopeOptions).map(l => ({ value: l, label: l }))
  ], [dynamicScopeOptions]);
  const scopeEntityOptions: EnhancedSelectOption[] = useMemo(() => scopeLevel === 'General' ? [] : (dynamicScopeOptions[scopeLevel as keyof typeof dynamicScopeOptions] || []).map(e => ({ value: e, label: e })), [scopeLevel, dynamicScopeOptions]);

  const validateFields = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es requerido.';
    if (!auditorId) errors.auditorId = 'El auditor es requerido.';
    if (!startDate) errors.startDate = 'La fecha de inicio es requerida.';
    if (!endDate) errors.endDate = 'La fecha de fin es requerida.';
    if (startDate && endDate && endDate < startDate) errors.endDate = 'La fecha de fin debe ser mayor o igual a la de inicio.';
    if (scopeLevel !== 'General' && !scopeEntity) errors.scopeEntity = `Seleccione una entidad para el nivel de ámbito "${scopeLevel}".`;
    
    dispatch({ type: 'SET_VALIDATION_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [name, auditorId, startDate, endDate, scopeLevel, scopeEntity]);

  const setField = useCallback((field: keyof State, payload: any) => {
    dispatch({ type: 'SET_FIELD', field, payload });
  }, []);

  return {
    state,
    dispatch,
    setField,
    auditorOptions,
    projectOptions,
    scopeLevelOptions,
    scopeEntityOptions,
    validateFields,
  };
}
