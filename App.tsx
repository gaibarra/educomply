
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import type { Session, Profile, InstitutionProfileRow } from './types';
import type { View } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NormativasView from './components/NormativasView';
import TareasView from './components/TareasView';
import AuditoriasView from './components/AuditoriasView';
import ReportesView from './components/ReportesView';
import InstitucionView from './components/InstitucionView';
import ProyectosView from './components/ProyectosView';
import UsersAdminView from './components/UsersAdminView';
import GanttView from './components/GanttView';
import AdminReprogramView from './components/AdminReprogramView';
import Header from './components/Header';
import { ToastProvider } from './components/ToastProvider';
import Auth from './components/Auth';
import ExclamationTriangleIcon from './components/icons/ExclamationTriangleIcon';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [institutionProfile, setInstitutionProfile] = useState<InstitutionProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [tareasInitialKeyword, setTareasInitialKeyword] = useState<string | null>(null);

  // Allow deep-linking via URL params, e.g., ?view=tareas&q=palabra
  useEffect(() => {
    const applyFromLocation = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        const qParam = params.get('q');
        if (qParam) setTareasInitialKeyword(qParam);
        if (viewParam === 'tareas' || viewParam === 'gantt' || viewParam === 'dashboard') {
          setActiveView(viewParam as View);
        }
      } catch { /* ignore */ }
    };
    applyFromLocation();
    const onPop = () => applyFromLocation();
    const navListener = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if(detail.view) {
        setActiveView(detail.view);
        if(detail.q) setTareasInitialKeyword(detail.q);
      }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('app:navigate', navListener as EventListener);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('app:navigate', navListener as EventListener);
    };
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAppData = async () => {
      if (session?.user) {
        setLoading(true);
        setProfile(null);
        setInstitutionProfile(null);
        setFetchError(null);
        try {
          const [
            { data: profileData, error: profileError },
            { data: institutionData, error: institutionError }
          ] = await Promise.all([
             supabase.from('profiles').select(`id, full_name, role, scope_entity`).eq('id', session.user.id).single(),
             supabase.from('institution_profile').select('*').eq('id', 1).single()
          ]);

          if (profileError) {
            if (profileError.code === 'PGRST116') {
              console.warn("Profile not found for user:", session.user.id);
              throw new Error("No se encontró un perfil para su usuario. Si es un usuario nuevo, el perfil puede estar creándose. Si el problema persiste, contacte a soporte.");
            }
            throw profileError;
          }
          
          if (institutionError && institutionError.code !== 'PGRST116') {
             throw new Error(`Error al cargar datos de la institución: ${institutionError.message}`);
          }

          if (profileData) {
            setProfile(profileData as unknown as Profile);
          } else {
            throw new Error("Respuesta inesperada del servidor: no se recibieron datos del perfil.");
          }

          if (institutionData) {
            setInstitutionProfile({
                ...institutionData,
                locations: institutionData.locations || [],
                educational_levels: institutionData.educational_levels || [],
                authorities: institutionData.authorities || [],
                academic_programs: institutionData.academic_programs || [],
            });
          }

        } catch (error: any) {
          console.error("Error fetching app data. Raw error object below:");
          console.error(error);

          let displayMessage = 'Ocurrió un error inesperado al cargar los datos de la aplicación.';
          
          if (error && typeof error === 'object') {
            const err = error as { code?: string; message?: string; details?: string; hint?: string };
            
            if (err.code === '42P17' || (err.message && String(err.message).includes('infinite recursion'))) {
                displayMessage = "Error Crítico de Configuración de Seguridad (RLS). Causa: recursión infinita al cargar su perfil. Esto es un problema de configuración en la base de datos que debe ser resuelto por un administrador. SOLUCIÓN: En el Dashboard de Supabase, para la tabla 'profiles', la política de SELECT para usuarios autenticados debe tener la expresión USING: (auth.uid() = id).";
            } else if (err.message) {
                displayMessage = `Error al cargar datos: ${err.message}`;
            }
          } else if (error instanceof Error) {
            displayMessage = error.message;
          }
          
          setFetchError(displayMessage);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setInstitutionProfile(null);
        setLoading(false);
      }
    };

    fetchAppData();
  }, [session]);

  const handleInstitutionUpdate = (updatedProfile: InstitutionProfileRow | null) => {
    setInstitutionProfile(updatedProfile);
  };

  const renderContent = () => {
    if (fetchError) {
        return (
            <div className="p-8 m-4 sm:m-8 bg-red-50 border border-red-200 rounded-lg text-center animate-fade-in">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <ExclamationTriangleIcon className="h-6 w-6 text-status-danger" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-red-800">Error al Cargar Perfil</h3>
                <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                    {fetchError}
                </p>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="mt-6 inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-status-danger hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Cerrar Sesión
                </button>
            </div>
        );
    }

    if (!profile) {
      return (
          <div className="flex justify-center items-center h-full p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
          </div>
      );
    }


    switch (activeView) {
      case 'dashboard':
        return <Dashboard profile={profile} setActiveView={setActiveView} institutionProfile={institutionProfile} setTareasInitialKeyword={setTareasInitialKeyword} />;
      case 'gantt': {
        const inferDefaultCode = (inst?: InstitutionProfileRow | null) => {
          if (inst?.phone_country_code) return inst.phone_country_code;
          try {
            const parts: string[] = [];
            if (inst?.name) parts.push(inst.name);
            if (inst?.legal_representative) parts.push(inst.legal_representative);
            (inst?.locations || []).forEach(l => parts.push(l.name || '', l.address || ''));
            const text = parts.join(' ').toLowerCase();
            if (text.includes('colombia')) return '+57';
            if (text.includes('argentina')) return '+54';
            if (text.includes('perú') || text.includes('peru')) return '+51';
            if (text.includes('chile')) return '+56';
            if (text.includes('ecuador')) return '+593';
            if (text.includes('méxico') || text.includes('mexico')) return '+52';
          } catch {
            // ignore errors inferring country code
          }
          return '+52';
        };
        const phoneCountryCodeDefault = inferDefaultCode(institutionProfile);
        return <GanttView profile={profile} setActiveView={setActiveView} setTaskSearchKeyword={setTareasInitialKeyword} phoneCountryCodeDefault={phoneCountryCodeDefault} />;
      }
      case 'normativas':
        return <NormativasView profile={profile} setActiveView={setActiveView} institutionProfile={institutionProfile} />;
      case 'tareas':
        return <TareasView profile={profile} initialKeyword={tareasInitialKeyword ?? ''} />;
      case 'auditorias':
        return <AuditoriasView profile={profile} institutionProfile={institutionProfile} />;
      case 'reportes':
        return <ReportesView profile={profile} />;
      case 'institucion':
        return <InstitucionView profile={profile} institutionProfile={institutionProfile} onUpdate={handleInstitutionUpdate} />;
      case 'proyectos':
        return <ProyectosView profile={profile} />;
      case 'usuarios':
        return <UsersAdminView profile={profile} />;
      case 'reprogramar':
        return <AdminReprogramView profile={profile} />;
      default:
        return <Dashboard profile={profile} setActiveView={setActiveView} institutionProfile={institutionProfile} setTareasInitialKeyword={setTareasInitialKeyword} />;
    }
  };

  if (loading && !profile) {
     return (
        <div className="flex justify-center items-center h-screen bg-transparent">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-primary"></div>
        </div>
     );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen font-sans">
        <Sidebar activeView={activeView} setActiveView={setActiveView} profile={profile} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header session={session} profile={profile} institutionProfile={institutionProfile} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App;