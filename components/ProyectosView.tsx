import React, { useEffect, useState } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { supabase } from '../services/supabaseClient';
import type { Profile, ProjectRow, ProjectMemberRow, ProjectRole } from '../types';

interface ProyectosViewProps {
  profile: Profile;
}

type Member = { user_id: string; full_name: string; role: ProjectRole };

const ProyectosView: React.FC<ProyectosViewProps> = ({ profile }) => {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, Member[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [inviteOpen, setInviteOpen] = useState<string | null>(null); // project_id
  const [inviteEmail, setInviteEmail] = useState('');
  const [emailOptions, setEmailOptions] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member');
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Intentar leer proyectos si la tabla existe
        const { data, error } = await supabase.from('projects' as any).select('id, name, description, created_at, owner_id');
        if (error) throw error;
        const rows = (data as unknown as (ProjectRow & { owner_id: string })[]) || [];
        setProjects(rows.map(r => ({ id: r.id, name: r.name, description: r.description ?? null, owner_id: r.owner_id, created_at: r.created_at! })));
        // load members per project
        if (rows.length) {
          const projectIds = rows.map(r => r.id);
          const { data: mdata, error: merr } = await supabase
           .from('project_members' as any)
           .select('project_id, user_id, role')
           .in('project_id', projectIds);
          if (merr) throw merr;
          const memberRows = (mdata as any[]) || [];
          const userIds = Array.from(new Set(memberRows.map((r: any) => r.user_id)));
          let namesById: Record<string, string> = {};
          if (userIds.length) {
            const { data: profs, error: perr } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
            if (perr) throw perr;
            namesById = ((profs as any[]) || []).reduce((acc, p: any) => { acc[p.id] = p.full_name || p.id; return acc; }, {} as Record<string,string>);
          }
          const byProj: Record<string, Member[]> = {};
          memberRows.forEach((row: any) => {
            const m: Member = { user_id: row.user_id, full_name: namesById[row.user_id] || row.user_id, role: row.role };
            (byProj[row.project_id] = byProj[row.project_id] || []).push(m);
          });
          setMembersByProject(byProj);
        }
      } catch (e: any) {
        // Si no existe la tabla o RLS bloquea, mostrar un mensaje amable sin romper la app
        const msg = typeof e?.message === 'string' ? e.message : 'No se pudieron cargar proyectos.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.id]);

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const payload = { name: newName.trim(), description: newDesc.trim() || null, owner_id: profile.id } as any;
      const { data, error } = await supabase.from('projects' as any).insert(payload).select('id, name, description, created_at').single();
      if (error) throw error;
      setProjects(prev => [data as unknown as ProjectRow, ...prev]);
      setNewName('');
      setNewDesc('');
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'No se pudo crear el proyecto.';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteOpen || !inviteEmail.trim()) return;
    setSavingInvite(true);
    setError(null);
    try {
      // resolve user_id by email via RPC
      const { data: resolvedId, error: rpcErr } = await supabase.rpc('get_user_id_by_email', { p_email: inviteEmail.trim() });
      if (rpcErr) throw rpcErr;
      if (!resolvedId) throw new Error('No se encontró un usuario con ese email.');
      const payload: Partial<ProjectMemberRow> = { project_id: inviteOpen, user_id: resolvedId as string, role: inviteRole };
      const { error } = await supabase.from('project_members' as any).insert(payload as any);
      if (error) throw error;
      // update local members list
      setMembersByProject(prev => ({
        ...prev,
        [inviteOpen]: [ ...(prev[inviteOpen] || []), { user_id: resolvedId as string, full_name: inviteEmail, role: inviteRole } ]
      }));
      setInviteEmail('');
      setInviteRole('member');
      setInviteOpen(null);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'No se pudo invitar al miembro.';
      setError(msg);
    } finally {
      setSavingInvite(false);
    }
  };

  const updateProject = async (project: ProjectRow, fields: Partial<Pick<ProjectRow, 'name' | 'description'>>) => {
    setSavingProjectId(project.id);
    try {
      const { error } = await supabase.from('projects' as any).update(fields as any).eq('id', project.id);
      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...fields } as ProjectRow : p));
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'No se pudo actualizar el proyecto.');
    } finally {
      setSavingProjectId(null);
    }
  };

  const deleteProject = async (project: ProjectRow) => {
    if (!confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    setSavingProjectId(project.id);
    try {
      const { error } = await supabase.from('projects' as any).delete().eq('id', project.id);
      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setMembersByProject(prev => { const copy = { ...prev }; delete copy[project.id]; return copy; });
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'No se pudo eliminar el proyecto.');
    } finally {
      setSavingProjectId(null);
    }
  };

  const removeMember = async (projectId: string, userId: string) => {
    try {
      const { error } = await supabase.from('project_members' as any).delete().eq('project_id', projectId).eq('user_id', userId);
      if (error) throw error;
      setMembersByProject(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter(m => m.user_id !== userId)
      }));
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'No se pudo eliminar el miembro.');
    }
  };

  const changeMemberRole = async (projectId: string, userId: string, role: ProjectRole) => {
    try {
      const { error } = await supabase.from('project_members' as any).update({ role } as any).eq('project_id', projectId).eq('user_id', userId);
      if (error) throw error;
      setMembersByProject(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).map(m => m.user_id === userId ? { ...m, role } : m)
      }));
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'No se pudo cambiar el rol.');
    }
  };

  const inputBase = "w-full px-3 py-2 rounded-md text-sm focus:outline-none transition outline-none";
  const inputGlass = `${inputBase} bg-white/10 border border-white/20 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary/60`;
  const cardGlass = "glass rounded-xl border border-white/10 shadow-lg backdrop-blur-sm";
  const gradientBtn = "text-white font-medium px-4 py-2 rounded-lg shadow hover:shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-gradient">Proyectos</h2>
        <p className="text-sm text-slate-300">Administre equipos, espacios de trabajo y miembros colaborativos.</p>
      </div>

      <div className={`${cardGlass} p-5 space-y-4 animate-fade-in`}> 
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-tr from-indigo-400 via-fuchsia-400 to-cyan-300 animate-pulse" />
            Crear proyecto
          </h3>
          {creating && <span className="text-xs text-slate-400 animate-pulse">Guardando…</span>}
        </div>
        <div className="flex flex-col lg:flex-row gap-3">
          <input
            className={inputGlass}
            placeholder="Nombre del proyecto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={inputGlass}
            placeholder="Descripción (opcional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button
            onClick={createProject}
            disabled={creating || !newName.trim()}
            className={`${gradientBtn}`}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)' }}
          >
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">Usa nombres claros; puedes editar después directamente en la tarjeta.</p>
        {error && (
          <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded px-3 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />{error}
          </div>
        )}
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
          Cargando proyectos…
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className={`${cardGlass} p-6 text-center text-slate-300`}>Aún no hay proyectos. ¡Crea el primero y comienza a organizar el trabajo!</div>
      )}

      {!loading && !error && projects.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map(p => {
            const members = membersByProject[p.id] || [];
            return (
              <li key={p.id} className={`${cardGlass} p-5 group relative overflow-visible transition hover:border-white/20 hover:shadow-xl hover:scale-[1.01]`}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-gradient-to-br from-white/5 via-transparent to-white/5" />
                <div className="flex items-start gap-3">
                  <input
                    className="flex-1 bg-transparent text-lg font-semibold text-slate-100 border border-transparent focus:border-white/30 rounded px-1 transition placeholder-slate-500"
                    value={p.name}
                    placeholder="Nombre"
                    onChange={(e) => updateProject(p, { name: e.target.value })}
                    disabled={savingProjectId === p.id}
                  />
                  <button
                    className="text-xs text-rose-300 hover:text-rose-200 hover:underline disabled:opacity-40"
                    onClick={() => deleteProject(p)}
                    disabled={savingProjectId === p.id}
                  >Eliminar</button>
                </div>
                <textarea
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-md p-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Descripción"
                  rows={3}
                  value={p.description || ''}
                  onChange={(e) => updateProject(p, { description: e.target.value })}
                  disabled={savingProjectId === p.id}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  {p.created_at && <span>Creado: {new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/30">{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</span>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <button className="text-xs px-3 py-1 rounded-md bg-white/10 border border-white/15 text-slate-100 hover:bg-white/15 transition" onClick={() => setInviteOpen(p.id)}>Invitar miembro</button>
                </div>
                {inviteOpen === p.id && (
                  <div className="mt-4 space-y-3 bg-white/5 border border-white/10 rounded-lg p-4 relative">
                    <div className="text-xs font-medium tracking-wide text-slate-300">Agregar usuario por correo</div>
                    <div className="flex flex-col sm:flex-row gap-3 relative">
                      <div className="flex-1 relative">
                        <input
                          className={inputGlass + ' pr-8'}
                          placeholder="email@dominio.com"
                          value={inviteEmail}
                          onChange={async (e) => {
                            const v = e.target.value;
                            setInviteEmail(v);
                            if (v && v.length >= 2) {
                              try {
                                const { data, error } = await supabase.rpc('search_user_emails', { p_prefix: v });
                                if (!error && Array.isArray(data)) {
                                  setEmailOptions((data as any[]).map((r: any) => r.email));
                                }
                              } catch { /* ignore */ }
                            } else {
                              setEmailOptions([]);
                            }
                          }}
                        />
                        {emailOptions.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 w-full glass border border-white/15 rounded-lg max-h-48 overflow-auto z-20">
                            {emailOptions.map(opt => (
                              <div key={opt} className="px-3 py-2 text-sm cursor-pointer text-slate-100 hover:bg-white/10" onClick={() => { setInviteEmail(opt); setEmailOptions([]); }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-full sm:w-40">
                        <EnhancedSelect
                          value={inviteRole}
                          onChange={(v)=> setInviteRole((v || 'member') as ProjectRole)}
                          options={[{value:'member',label:'Miembro'},{value:'viewer',label:'Lector'},{value:'admin',label:'Admin'}]}
                          placeholder="Rol"
                        />
                      </div>
                      <button
                        onClick={inviteMember}
                        disabled={savingInvite || !inviteEmail.trim()}
                        className={`${gradientBtn} text-xs`}
                        style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}
                      >
                        {savingInvite ? 'Guardando…' : 'Invitar'}
                      </button>
                      <button
                        onClick={() => { setInviteOpen(null); setEmailOptions([]); }}
                        className="px-4 py-2 rounded-md text-xs border border-white/15 text-slate-300 hover:text-slate-100 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {members.length > 0 && (
                  <div className="mt-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Miembros</div>
                    <ul className="space-y-2">
                      {members.map(m => (
                        <li key={m.user_id} className="flex items-center gap-3 text-sm group/member">
                          <span className="flex-1 text-slate-200 truncate">{m.full_name}</span>
                          <div className="w-36">
                            <EnhancedSelect
                              value={m.role}
                              onChange={(v)=> changeMemberRole(p.id, m.user_id, (v || m.role) as ProjectRole)}
                              options={[{value:'owner',label:'Owner'},{value:'admin',label:'Admin'},{value:'member',label:'Miembro'},{value:'viewer',label:'Lector'}]}
                              placeholder="Rol"
                            />
                          </div>
                          <button className="text-[10px] tracking-wide text-rose-300 hover:text-rose-200 opacity-70 hover:opacity-100 transition" onClick={() => removeMember(p.id, m.user_id)}>Eliminar</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ProyectosView;
