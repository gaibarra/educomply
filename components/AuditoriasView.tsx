
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, Audit, AuditFinding, InstitutionProfileRow, AuditRow, AuditFindingRow } from '../types';
import AuditCard from './AuditCard';
import CreateAuditModal from './CreateAuditModal';
import PlusCircleIcon from './icons/PlusCircleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

interface AuditoriasViewProps {
    profile: Profile;
    institutionProfile: InstitutionProfileRow | null;
}


const AuditoriasView: React.FC<AuditoriasViewProps> = ({ profile, institutionProfile }) => {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [auditors, setAuditors] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchAudits = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Because RLS is assumed to be active, we don't need to filter by user role here.
            // The database will only return audits the current user is allowed to see.
            const { data: auditRows, error: auditsError } = await supabase.from('audits').select('*').order('start_date', { ascending: false });
            if (auditsError) throw auditsError;

            if (!auditRows || auditRows.length === 0) {
                setAudits([]);
                setLoading(false);
                return;
            }

            const auditIds = auditRows.map(a => a.id);
            const auditorIds = [...new Set(auditRows.map(a => a.auditor_id).filter(Boolean))];

            // Fetch all related data in parallel
            const [
                { data: findingsData, error: findingsError },
                { data: profilesData, error: profilesError }
            ] = await Promise.all([
                supabase.from('audit_findings').select('*').in('audit_id', auditIds),
                supabase.from('profiles').select('id, full_name, role, scope_entity').in('id', auditorIds)
            ]);
            
            if (findingsError) throw findingsError;
            if (profilesError) throw profilesError;
            
            const typedFindingsData = findingsData as unknown as AuditFindingRow[];
            const typedProfilesData = profilesData as unknown as Profile[];

            // Create lookup maps for efficiency
            const findingsByAuditId = (typedFindingsData || []).reduce((acc, finding) => {
                (acc[finding.audit_id] = acc[finding.audit_id] || []).push(finding as AuditFinding);
                return acc;
            }, {} as Record<number, AuditFinding[]>);
            
            const profilesById = new Map((typedProfilesData || []).map(p => [p.id, p]));

            const combinedAudits: Audit[] = (auditRows as AuditRow[]).map(audit => ({
                ...audit,
                auditor: audit.auditor_id ? profilesById.get(audit.auditor_id) || null : null,
                findings: findingsByAuditId[audit.id] || [],
            }));
            
            setAudits(combinedAudits);

        } catch (err: any) {
            console.error("Error fetching audits:", err);
            setError(`Error al cargar las auditorías: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch users who can be auditors (e.g., admins or specific roles)
        const fetchAuditors = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role, scope_entity')
                // .in('role', ['admin', 'auditor_role']) // Example filter
                .order('full_name');
            if (data) setAuditors(data as Profile[]);
        };
        fetchAuditors();
        fetchAudits();
    }, [fetchAudits]);

    const handleUpdateAuditInList = (updatedAudit: Audit) => {
        setAudits(prevAudits => prevAudits.map(a => a.id === updatedAudit.id ? updatedAudit : a));
    };

    return (
        <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Gestión de Auditorías</h2>
                    <p className="text-slate-500">Planifique, ejecute y dé seguimiento a las auditorías de cumplimiento.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-brand-primary rounded-lg hover:bg-brand-secondary transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                >
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>Planificar Auditoría</span>
                </button>
            </div>

            {loading && (
                <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            )}

            {!loading && error && (
                 <div className="p-8 m-4 bg-red-50 border border-red-200 rounded-lg text-center animate-fade-in">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-status-danger" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-red-800">Error al Cargar Auditorías</h3>
                    <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                        {error}
                    </p>
                </div>
            )}
            
            {!loading && !error && audits.length === 0 && (
                <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-slate-300">
                    <ShieldCheckIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-lg font-medium text-slate-800">No hay auditorías planificadas</h3>
                    <p className="mt-1 text-sm text-slate-500">Haga clic en "Planificar Auditoría" para crear la primera.</p>
                </div>
            )}

            {!loading && !error && audits.length > 0 && (
                <div className="space-y-6">
                    {audits.map(audit => (
                        <AuditCard 
                            key={audit.id} 
                            audit={audit}
                            onUpdateAudit={handleUpdateAuditInList}
                        />
                    ))}
                </div>
            )}

            <CreateAuditModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={fetchAudits} // Refetch all audits after a new one is created
                auditors={auditors}
                institutionProfile={institutionProfile}
            />
        </div>
    );
};

export default AuditoriasView;