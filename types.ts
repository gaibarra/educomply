

import type { Session as SupabaseSession } from '@supabase/supabase-js';

export type View = 'dashboard' | 'normativas' | 'tareas' | 'auditorias' | 'reportes' | 'institucion' | 'proyectos' | 'usuarios' | 'gantt' | 'reprogramar';
export type Session = SupabaseSession;

// Define common enums/unions first
export type TaskStatus = 'Pendiente' | 'En Progreso' | 'Completada';

// --- Nuevos Tipos para Ámbito (Scope) ---
export type ScopeLevel = 'Institución' | 'Campus' | 'Nivel Educativo' | 'Facultad/Escuela';

export interface TaskScope {
  level: ScopeLevel;
  entity: string;
  category: string;
  source: string;
  due_date: string;
}

// --- Individual Table Row Types for clarity and performance ---
export interface CommentRow {
  author_id: string;
  author_name: string;
  created_at: string;
  id: number;
  sub_task_id: string; // uuid of sub_tasks.id
  text: string;
};

export interface DocumentRow {
  created_at: string;
  id: number;
  name: string;
  storage_path: string;
  sub_task_id: string; // uuid of sub_tasks.id
  url: string;
};

export interface ProfileRow {
  created_at: string;
  full_name: string;
  id: string;
  role: "admin" | "director_campus" | "director_facultad" | "usuario";
  scope_entity: string | null;
  mobile?: string | null; // numero movil
  position?: string | null; // puesto
  campus?: string | null; // localizacion - campus
  area?: string | null; // localizacion - area
};

export interface ResponsibleAreaRow {
  id: number;
  name: string;
};

export interface SubTaskRow {
  assigned_to_id: string | null;
  created_at: string;
  description: string;
  id: string; // uuid
  status: TaskStatus;
  task_id: string; // Changed from number to string for UUID
};

export interface TaskRow {
  created_at: string;
  description: string;
  documents: string[] | null;
  id: string; // Changed from number to string for UUID
  responsible_area_id: number;
  responsible_person_id: string;
  owner_id: string;
  project_id: string | null;
  scope: TaskScope | null;
};

// --- Tipos para el Módulo de Auditorías ---
export type AuditStatus = 'Planificada' | 'En Progreso' | 'Completada' | 'Cancelada';
export type AuditPhaseKey = 'planificacion' | 'ejecucion' | 'evaluacion' | 'seguimiento';
export interface AuditPhaseActivity { key: string; title: string; completed: boolean; notes?: string | null; }
export interface AuditPhasesState {
  planificacion?: { activities: AuditPhaseActivity[] };
  ejecucion?: { activities: AuditPhaseActivity[] };
  evaluacion?: { activities: AuditPhaseActivity[] };
  seguimiento?: { activities: AuditPhaseActivity[] };
}
export type FindingSeverity = 'Crítico' | 'Mayor' | 'Menor' | 'Observación';
export type FindingStatus = 'Abierto' | 'Cerrado';

export interface AuditFindingRow {
  id: number;
  created_at: string;
  audit_id: number;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  recommendation: string;
  related_task_id: string | null; // Changed from number to string for UUID
}

export interface AuditRow {
  id: number;
  created_at: string;
  name: string;
  scope_level: ScopeLevel | 'General';
  scope_entity: string | null;
  status: AuditStatus;
  start_date: string;
  end_date: string;
  auditor_id: string; // uuid from profiles
  project_id?: string | null; // uuid
  ai_description?: string | null;
  ai_raw_suggestion?: any | null;
  current_phase?: AuditPhaseKey | null;
  phase_activities?: AuditPhasesState | null;
  phase_log?: { ts: string; from: AuditPhaseKey | null; to: AuditPhaseKey | null; actor?: string | null }[] | null;
}

export interface AuditTaskLinkRow {
    audit_id: number;
    task_id: string; // Changed from number to string for UUID
}

// --- Tipos para el Módulo de Institución ---
export interface InstitutionLocation {
  id: string;
  name: string;
  address: string;
}

export interface InstitutionAuthority {
  id: string;
  position: string;
  name: string;
}

export interface AcademicProgram {
  id: string;
  name: string;
  level: 'Licenciatura' | 'Posgrado';
  faculty: string;
}

export interface InstitutionProfileRow {
  id: 1;
  name: string | null;
  legal_representative: string | null;
  logo_url: string | null;
  phone_country_code?: string | null; // E.164 country calling code, e.g., +52
  locations: InstitutionLocation[];
  educational_levels: string[];
  authorities: InstitutionAuthority[];
  academic_programs: AcademicProgram[];
}

// --- Proyectos/Equipos ---
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ProjectRow {
  id: string; // uuid
  name: string;
  description: string | null;
  owner_id: string; // profiles.id
  created_at: string;
}

export interface ProjectMemberRow {
  project_id: string; // uuid
  user_id: string; // uuid
  role: ProjectRole;
  created_at: string;
}


// --- Supabase Database Definition ---
export type Database = {
  public: {
    Tables: {
      comments: {
        Row: CommentRow;
        Insert: {
          author_id: string;
          author_name: string;
          created_at?: string;
          id?: number;
          sub_task_id: string; // uuid
          text: string;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          sub_task_id?: string; // uuid
          text?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: {
          created_at?: string;
          id?: number;
          name: string;
          storage_path: string;
          sub_task_id: string; // uuid
          url: string;
        };
        Update: {
          name?: string;
          storage_path?: string;
          sub_task_id?: string; // uuid
          url?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          role: "admin" | "director_campus" | "director_facultad" | "usuario";
          scope_entity: string | null;
          mobile?: string | null;
          position?: string | null;
          campus?: string | null;
          area?: string | null;
        };
        Update: {
          full_name?: string;
          role?: "admin" | "director_campus" | "director_facultad" | "usuario";
          scope_entity?: string | null;
          mobile?: string | null;
          position?: string | null;
          campus?: string | null;
          area?: string | null;
        };
        Relationships: [];
      };
      responsible_areas: {
        Row: ResponsibleAreaRow;
        Insert: { id?: number; name: string };
        Update: {
            name?: string;
        };
        Relationships: [];
      };
      sub_tasks: {
        Row: SubTaskRow;
        Insert: {
          assigned_to_id?: string | null;
          created_at?: string;
          description: string;
          id?: string; // uuid
          status?: TaskStatus;
          task_id: string; // Changed from number
        };
        Update: {
          assigned_to_id?: string | null;
          description?: string;
          status?: TaskStatus;
        };
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: {
          id?: string; // Changed from number
          created_at?: string;
          description: string;
          documents?: string[] | null;
          responsible_area_id: number;
          responsible_person_id: string;
          owner_id?: string;
          project_id?: string | null;
          scope?: TaskScope | null;
        };
        Update: {
            description?: string;
            documents?: string[] | null;
            responsible_area_id?: number;
            responsible_person_id?: string;
            owner_id?: string;
            project_id?: string | null;
            scope?: TaskScope | null;
        };
        Relationships: [];
      };
      audits: {
        Row: AuditRow;
        Insert: {
          name: string;
          scope_level: ScopeLevel | 'General';
          scope_entity: string | null;
          status: AuditStatus;
          start_date: string;
          end_date: string;
          auditor_id: string;
          project_id?: string | null;
          ai_description?: string | null;
          ai_raw_suggestion?: any | null;
          current_phase?: AuditPhaseKey | null;
          phase_activities?: AuditPhasesState | null;
          phase_log?: { ts: string; from: AuditPhaseKey | null; to: AuditPhaseKey | null; actor?: string | null }[] | null;
        };
        Update: {
          name?: string;
          scope_level?: ScopeLevel | 'General';
          scope_entity?: string | null;
          status?: AuditStatus;
          start_date?: string;
          end_date?: string;
          auditor_id?: string;
          project_id?: string | null;
          ai_description?: string | null;
          ai_raw_suggestion?: any | null;
          current_phase?: AuditPhaseKey | null;
          phase_activities?: AuditPhasesState | null;
          phase_log?: { ts: string; from: AuditPhaseKey | null; to: AuditPhaseKey | null; actor?: string | null }[] | null;
        };
        Relationships: [];
      };
      audit_findings: {
        Row: AuditFindingRow;
        Insert: {
          audit_id: number;
          description: string;
          severity: FindingSeverity;
          status: FindingStatus;
          recommendation: string;
          related_task_id: string | null; // Changed from number
        };
        Update: {
          description?: string;
          severity?: FindingSeverity;
          status?: FindingStatus;
          recommendation?: string;
          related_task_id?: string | null; // Changed from number
        };
        Relationships: [];
      };
      audit_tasks: {
          Row: AuditTaskLinkRow;
          Insert: {
            audit_id: number;
            task_id: string; // Changed from number
          };
          Update: Record<string, never>; // no editable fields currently
          Relationships: [];
      };
      institution_profile: {
          Row: InstitutionProfileRow;
          Insert: {
            id?: 1;
            name?: string | null;
            legal_representative?: string | null;
            logo_url?: string | null;
            phone_country_code?: string | null;
            locations?: InstitutionLocation[];
            educational_levels?: string[];
            authorities?: InstitutionAuthority[];
            academic_programs?: AcademicProgram[];
          };
          Update: {
            name?: string | null;
            legal_representative?: string | null;
            logo_url?: string | null;
            phone_country_code?: string | null;
            locations?: InstitutionLocation[];
            educational_levels?: string[];
            authorities?: InstitutionAuthority[];
            academic_programs?: AcademicProgram[];
          };
          Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id?: string; // default to auth.uid() in DB; set explicitly from client if needed
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      project_members: {
        Row: ProjectMemberRow;
        Insert: {
          project_id: string;
          user_id: string;
          role?: ProjectRole; // default 'member'
          created_at?: string;
        };
        Update: {
          role?: ProjectRole;
        };
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      reminders: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          remind_at: string | null;
          created_at: string;
          meta: any | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id?: string; // default auth.uid() en DB
          remind_at?: string | null;
          created_at?: string;
          meta?: any | null;
        };
        Update: {
          remind_at?: string | null;
          meta?: any | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// A subset of profile fields used for joins and display throughout the app.
// Using a type alias for ProfileRow helps prevent "Type instantiation is excessively deep" errors
// by simplifying type resolution for the TypeScript compiler, especially with complex nested types from Supabase.
export type Profile = ProfileRow;

// A simpler profile type to be used in nested relationships to avoid circular dependencies.
export type SimpleProfile = Pick<Profile, 'id' | 'full_name' | 'role' | 'scope_entity'>;


export interface ComplianceObligation {
  id: string;
  name: string;
  category: 'Laboral' | 'Fiscal' | 'Protección Civil' | 'Académica' | 'Salud' | string;
  authority: string;
  dueDate: string;
  status: 'Cumplido' | 'Pendiente' | 'Vencido';
  rawDueISO?: string; // ISO (YYYY-MM-DD) para acciones (recordatorios, etc.)
}

export interface Kpi {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
}

export interface AiObligation {
  obligation: string;
  source: string;
  category: string;
  requiredDocuments?: string[];
}

export interface AiComplianceResponse {
  summary: string;
  obligations: AiObligation[];
  recommendations: string[];
}

export interface AiAuditPlanSuggestion {
  name: string;
  scope_level: ScopeLevel | 'General';
  scope_entity: string;
}

export type ResponsibleArea = ResponsibleAreaRow;

export interface ScopeSelection {
    level: ScopeLevel;
    entities: string[];
}

export interface EditableAiObligation extends AiObligation {
  id: string;
  selected: boolean;
  responsible_area_id: number | null;
  responsible_person_id: string | null; // uuid
  due_date: string;
  scope: ScopeSelection;
  documents: {
      name: string;
      selected: boolean;
  }[];
}

// --- Tipos alineados con la BBDD de Supabase ---

export type TaskOverallStatus = 'Pendiente' | 'En Progreso' | 'Completada' | 'Atrasada';

export type AttachedDocument = DocumentRow;

export type TaskComment = CommentRow;

// --- Refactored Composite UI Types to prevent deep instantiation errors ---
// By defining interfaces with explicit properties rather than extending Row types, 
// we create truly flat composite types that prevent recursive loops in the TS compiler.

export interface SubTask {
  id: string; // uuid
  task_id: string;
  description: string;
  status: TaskStatus;
  assigned_to_id: string | null;
  created_at: string;
  comments: TaskComment[];
  documents: AttachedDocument[];
  assigned_to: SimpleProfile | null;
}

export interface Task {
  id: string;
  created_at: string;
  description: string;
  documents: string[] | null;
  responsible_area_id: number;
  responsible_person_id: string;
  scope: TaskScope | null;
  subTasks: SubTask[];
  responsible_area: { name: string } | null;
  responsible_person: SimpleProfile | null;
  // Metadata de finalización (opcional hasta que se aplique migración SQL)
  completed_by?: string | null;
  completed_at?: string | null;
  completed_by_profile?: SimpleProfile | null;
  // Suspension metadata (optional, frontend-managed until DB migration adds persistent fields)
  suspended?: boolean;
  suspension_reason?: string | null;
  suspended_by?: string | null;
  suspended_at?: string | null;
}

export type TaskFromDb = TaskRow;

export interface TaskFilters {
    keyword: string;
    category: string;
    responsibleArea: string;
    responsiblePerson: string;
    status: string;
    dueDateStart: string;
    dueDateEnd: string;
    scopeLevel: string;
    scopeEntity: string;
}

// --- Composite types for Audit UI ---
export type AuditFinding = AuditFindingRow;

export interface Audit {
    id: number;
    created_at: string;
    name: string;
    scope_level: ScopeLevel | 'General';
    scope_entity: string | null;
    status: AuditStatus;
    start_date: string;
    end_date: string;
    auditor_id: string; // uuid from profiles
    auditor: SimpleProfile | null;
    findings: AuditFinding[];
  current_phase?: AuditPhaseKey | null;
  phase_activities?: AuditPhasesState | null;
  phase_log?: { ts: string; from: AuditPhaseKey | null; to: AuditPhaseKey | null; actor?: string | null }[] | null;
}


// --- Types for Reports Module ---
export type PredefinedReportType = 'general_status' | 'tasks_by_area' | 'overdue_tasks' | 'audit_findings' | 'workload_by_person';

export interface GeneratedReport {
    title: string;
    content: string; // Markdown content
}

