import React, { useEffect, useMemo, useState } from 'react';
import EnhancedSelect from './EnhancedSelect';
import { supabase } from '../services/supabaseClient';
import type { Profile, InstitutionProfileRow, ResponsibleAreaRow } from '../types';

type NewUser = {
  email: string;
  password: string;
  full_name: string;
  role: Profile['role'];
  mobile?: string;
  position?: string;
  campus?: string;
  area?: string;
};

const initialUser: NewUser = {
  email: '',
  password: '',
  full_name: '',
  role: 'usuario',
  mobile: '',
  position: '',
  campus: '',
  area: ''
};

const UsersAdminView: React.FC<{ profile: Profile; institutionProfile: InstitutionProfileRow | null; }>= ({ profile, institutionProfile }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);
  const [form, setForm] = useState<NewUser>(initialUser);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | Profile['role']>('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'created_at'|'full_name'|'role'|'mobile'|'position'|'campus'|'area'|'email'>('created_at');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [phoneCountry, setPhoneCountry] = useState<'MX'|'US'>('MX');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [lastCreds, setLastCreds] = useState<{ email: string; password: string } | null>(null);
  const [areas, setAreas] = useState<ResponsibleAreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState<string|null>(null);
  const [showAreasPanel, setShowAreasPanel] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [editingAreaId, setEditingAreaId] = useState<number|null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaOpError, setAreaOpError] = useState<string|null>(null);

  const isAdmin = useMemo(() => profile.role === 'admin', [profile.role]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let query = supabase
          .from('profiles')
          .select('id, full_name, role, scope_entity, mobile, position, campus, area, email', { count: 'exact' });
        if (roleFilter !== 'Todos') query = query.eq('role', roleFilter);
        if (search) query = query.ilike('full_name', `%${search}%`);
        query = query.order(sortBy, { ascending: sortDir === 'asc' });
        query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  // data may omit some DB columns depending on the select projection; cast via unknown to Profile[] to satisfy TS
  setUsers(((data || []) as unknown) as Profile[]);
        setTotal(count || 0);
      } catch (e: any) {
        setError(e?.message || 'No se pudieron cargar los usuarios');
      } finally { setLoading(false); }
    };
    if (isAdmin) load();
  }, [isAdmin, page, pageSize, sortBy, sortDir, search, roleFilter]);

  // Cargar catálogo de áreas
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAreas = async () => {
      setAreasLoading(true); setAreasError(null);
      try {
        const { data, error } = await supabase.from('responsible_areas').select('id,name').order('name');
        if (error) throw error;
        setAreas((data as any) || []);
      } catch (e:any) {
        setAreasError(e?.message || 'No se pudieron cargar las áreas');
      } finally { setAreasLoading(false); }
    };
    fetchAreas();
  }, [isAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const generatePassword = (len = 12) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%';
    let pwd = '';
    for (let i = 0; i < len; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm(prev => ({ ...prev, password: pwd }));
  };

  const isValidEmail = (email: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);
  const formatPhone = (country: 'MX'|'US', value: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (country === 'MX') {
      const last10 = digits.endsWith('52') ? digits.slice(0, -2) : digits.slice(-10);
      if (last10.length !== 10) return { ok: false, value };
      return { ok: true, value: `+52 ${last10.slice(0,3)} ${last10.slice(3,6)} ${last10.slice(6)}` };
    }
    const last10 = digits.slice(-10);
    if (last10.length !== 10) return { ok: false, value };
    return { ok: true, value: `+1 ${last10.slice(0,3)} ${last10.slice(3,6)} ${last10.slice(6)}` };
  };

  const createUser = async () => {
    setError(null); setSuccess(null);
    const { email, password, full_name, role, mobile, position, campus, area } = form;
    if (!email || !password || !full_name || !role) {
      setError('Complete correo, contraseña, nombre y tipo de usuario.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Ingrese un correo válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      // Call Edge Function (service role) to create auth user + profile
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password, full_name, role, mobile, position, campus, area }
      } as any);
      if (error) {
        // Edge function non-2xx -> error.message is generic; try to extract detailed error from payload
        const fnError = (data as any)?.error || (data as any)?.message;
        throw new Error(fnError || error.message || 'Fallo desconocido (Edge Function)');
      }
      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }
  setSuccess('Usuario creado correctamente.');
  setLastCreds({ email, password });
  setForm(initialUser);
  setPage(1);
    } catch (e:any) {
      setError(e?.message || 'No se pudo crear el usuario');
    } finally { setLoading(false); }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-lg text-amber-200">Solo el administrador puede acceder a esta sección.</div>
      </div>
    );
  }

  const inputBase = "w-full p-2 rounded-md text-sm focus:outline-none";
  const inputCls = `${inputBase} bg-white/10 border border-white/20 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary`;
  // selectCls removed after migrating to EnhancedSelect
  const labelCls = "text-xs text-slate-300";
  const cardCls = "glass rounded-xl shadow-lg border border-white/10";

  // Server-side filtering/pagination in effect; no local filteredUsers needed.

  const exportCsv = () => {
    const headers = ['Nombre','Correo','Rol','Móvil','Puesto','Campus','Área'];
    const rows = users.map(u => [
      u.full_name,
      (u as any).email || '',
      u.role,
      (u as any).mobile || '',
      (u as any).position || '',
      (u as any).campus || '',
      (u as any).area || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gradient">Gestión de Usuarios</h2>
          <p className="text-sm text-slate-300">Crear usuarios con correo, nombre, tipo, móvil, puesto, localización (campus/área) y contraseña inicial.</p>
        </div>
        <div className="hidden md:flex gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <input value={search} onChange={e=>{ setPage(1); setSearch(e.target.value); }} placeholder="Buscar por nombre..." className="bg-transparent placeholder-slate-400 text-slate-100 focus:outline-none text-sm"/>
            <div className="w-44">
              <EnhancedSelect
                value={roleFilter === 'Todos'? '' : roleFilter}
                onChange={(v)=> { setPage(1); setRoleFilter((v || 'Todos') as any); }}
                options={[{value:'',label:'Todos'},{value:'usuario',label:'Usuario'},{value:'director_campus',label:'Director Campus'},{value:'director_facultad',label:'Director Facultad'},{value:'admin',label:'Administrador'}]}
                placeholder="Rol"
              />
            </div>
            <button onClick={exportCsv} className="text-white text-xs font-semibold px-3 py-1.5 rounded" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)'}}>Exportar CSV</button>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5 space-y-4`}>
        <h3 className="text-lg font-semibold text-slate-100">Nuevo Usuario</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Correo</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className={inputCls} placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className={labelCls}>Contraseña inicial</label>
            <div className="flex gap-2">
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} className={inputCls + ' flex-1'} placeholder="********" />
              <button type="button" onClick={()=>setShowPassword(s=>!s)} className="px-3 rounded-md bg-white/10 border border-white/20 text-slate-100 text-xs">{showPassword ? 'Ocultar' : 'Ver'}</button>
              <button type="button" onClick={()=>generatePassword()} className="px-3 rounded-md bg-white/10 border border-white/20 text-slate-100 text-xs">Generar</button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} className={inputCls} placeholder="Nombre Apellido" />
          </div>
          <div>
            <label className={labelCls}>Tipo de usuario</label>
            <EnhancedSelect
              value={form.role}
              onChange={(v)=> setForm(prev=>({...prev, role: (v || 'usuario') as any}))}
              options={[{value:'usuario',label:'Usuario'},{value:'director_campus',label:'Director de Campus'},{value:'director_facultad',label:'Director de Facultad'},{value:'admin',label:'Administrador'}]}
              placeholder="Rol"
            />
          </div>
          <div>
            <label className={labelCls}>Número móvil</label>
            <div className="flex gap-2">
              <div className="w-28">
                <EnhancedSelect
                  value={phoneCountry}
                  onChange={(v)=> setPhoneCountry((v || 'MX') as any)}
                  options={[{value:'MX',label:'MX +52'},{value:'US',label:'US +1'}]}
                  placeholder="País"
                />
              </div>
              <input name="mobile" value={form.mobile} onChange={handleChange} onBlur={()=>{ const res = formatPhone(phoneCountry, form.mobile || ''); setPhoneError(res.ok ? null : `Número inválido para ${phoneCountry}`); if (res.ok) setForm(prev=>({ ...prev, mobile: res.value })); }} className={inputCls + ' flex-1'} placeholder={phoneCountry==='MX' ? '5512345678' : '5551234567'} />
            </div>
            {phoneError && <p className="text-xs text-rose-300 mt-1">{phoneError}</p>}
          </div>
          <div>
            <label className={labelCls}>Puesto</label>
            <input name="position" value={form.position} onChange={handleChange} className={inputCls} placeholder="Coordinador de Cumplimiento" />
          </div>
          <div>
            <label className={labelCls}>Campus</label>
            <EnhancedSelect
              value={form.campus || ''}
              onChange={(v)=> setForm(prev=>({ ...prev, campus: v || '' }))}
              options={(institutionProfile?.locations || []).map(l=>({ value: l.name, label: l.name }))}
              placeholder={(institutionProfile?.locations?.length || 0) > 0 ? 'Seleccionar campus' : 'Sin campus configurados'}
              searchable
              clearable
            />
          </div>
          <div>
            <label className={labelCls}>Área</label>
            <EnhancedSelect
              value={form.area || ''}
              onChange={(v)=> setForm(prev=>({ ...prev, area: v || '' }))}
              options={areas.map(a=>({ value: a.name, label: a.name }))}
              placeholder={areasLoading ? 'Cargando áreas...' : (areas.length? 'Seleccionar área':'Sin áreas configuradas')}
              searchable
              clearable
            />
            {areasError && <p className="text-xs text-rose-300 mt-1">{areasError}</p>}
            <button type="button" onClick={()=> setShowAreasPanel(s=>!s)} className="mt-2 text-[11px] underline text-slate-300 hover:text-white">{showAreasPanel? 'Ocultar gestión de áreas':'Gestionar áreas'}</button>
            {showAreasPanel && (
              <div className="mt-3 p-3 rounded-md bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 tracking-wide">Catálogo de Áreas</h4>
                <div className="flex gap-2 items-center">
                  <input
                    value={editingAreaId? editingAreaName : newAreaName}
                    onChange={e=> editingAreaId? setEditingAreaName(e.target.value) : setNewAreaName(e.target.value)}
                    placeholder={editingAreaId? 'Editar nombre de área' : 'Nombre de nueva área'}
                    className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/20 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"/>
                  {editingAreaId ? (
                    <>
                      <button disabled={areaSaving|| !editingAreaName.trim()} onClick={async()=>{
                        if(!editingAreaName.trim()) return; setAreaOpError(null); setAreaSaving(true);
                        try {
                          const { error } = await supabase.from('responsible_areas').update({ name: editingAreaName.trim() }).eq('id', editingAreaId);
                          if (error) throw error; setAreas(a=> a.map(ar=> ar.id===editingAreaId? { ...ar, name: editingAreaName.trim() }: ar));
                          if(form.area === editingAreaName) setForm(f=>({...f}));
                          setEditingAreaId(null); setEditingAreaName('');
                        } catch(e:any){ setAreaOpError(e?.message || 'Error al actualizar área'); } finally { setAreaSaving(false); }
                      }} className="px-3 py-1 rounded text-white text-xs bg-emerald-600 disabled:opacity-40">Guardar</button>
                      <button disabled={areaSaving} onClick={()=>{ setEditingAreaId(null); setEditingAreaName(''); }} className="px-3 py-1 rounded text-white text-xs bg-slate-600">Cancelar</button>
                    </>
                  ) : (
                    <button disabled={areaSaving || !newAreaName.trim()} onClick={async()=>{
                      if(!newAreaName.trim()) return; setAreaOpError(null); setAreaSaving(true);
                      try {
                        const name = newAreaName.trim();
                        if(areas.some(a=> a.name.toLowerCase() === name.toLowerCase())) { throw new Error('El área ya existe'); }
                        const { data, error } = await supabase.from('responsible_areas').insert({ name }).select('id,name').single();
                        if (error) throw error; if(data) setAreas(a=> [...a, data as any].sort((x,y)=> x.name.localeCompare(y.name)));
                        setNewAreaName('');
                      } catch(e:any){ setAreaOpError(e?.message || 'Error al crear área'); } finally { setAreaSaving(false); }
                    }} className="px-3 py-1 rounded text-white text-xs bg-brand-primary disabled:opacity-40">Agregar</button>
                  )}
                </div>
                {areaOpError && <p className="text-[11px] text-rose-300">{areaOpError}</p>}
                <ul className="max-h-48 overflow-y-auto space-y-1 pr-1 text-[11px]">
                  {areas.length === 0 && <li className="text-slate-400 italic">Sin áreas</li>}
                  {areas.map(a=> (
                    <li key={a.id} className="flex items-center gap-2 group">
                      <span className="flex-1 truncate text-slate-200">{a.name}</span>
                      <button onClick={()=>{ setEditingAreaId(a.id); setEditingAreaName(a.name); }} className="opacity-0 group-hover:opacity-100 transition text-xs px-2 py-0.5 rounded bg-white/10 text-slate-200 border border-white/10">Editar</button>
                      <button onClick={async()=>{
                        if(!confirm('¿Eliminar área?')) return; setAreaOpError(null); setAreaSaving(true);
                        try {
                          const { error } = await supabase.from('responsible_areas').delete().eq('id', a.id);
                          if(error) throw error; setAreas(list=> list.filter(x=> x.id!==a.id));
                          if(form.area === a.name) setForm(f=> ({ ...f, area: '' }));
                        } catch(e:any){ setAreaOpError(e?.message || 'Error al eliminar área'); } finally { setAreaSaving(false); }
                      }} className="opacity-0 group-hover:opacity-100 transition text-xs px-2 py-0.5 rounded bg-rose-600/80 text-white">X</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={createUser} disabled={loading} className="px-4 py-2 text-white rounded-lg hover:opacity-95 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}>{loading ? 'Creando...' : 'Crear Usuario'}</button>
        </div>
        {error && <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded px-3 py-2">{error}</div>}
        {success && (
          <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/20 rounded px-3 py-3 flex items-center justify-between gap-3">
            <span>{success}</span>
            {lastCreds && (
              <div className="flex items-center gap-2">
                <button onClick={()=> navigator.clipboard.writeText(`Usuario: ${lastCreds.email}\nContraseña: ${lastCreds.password}`)} className="text-slate-100 bg-white/10 border border-white/20 rounded px-3 py-1">Copiar credenciales</button>
                <a href={`mailto:${lastCreds.email}?subject=Acceso%20EduComply&body=${encodeURIComponent(`Hola,\n\nSe creó tu cuenta en EduComply.\n\nUsuario: ${lastCreds.email}\nContraseña temporal: ${lastCreds.password}\n\nTe recomendamos cambiarla al iniciar sesión.\n\nSaludos.`)}`} className="text-white rounded px-3 py-1" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)'}}>Enviar por correo</a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">Usuarios</h3>
          <span className="text-xs text-slate-300">{total} {total === 1 ? 'usuario' : 'usuarios'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300 select-none">
                {(([
                  ['full_name','Nombre'],
                  ['email','Correo'],
                  ['role','Rol'],
                  ['mobile','Móvil'],
                  ['position','Puesto'],
                  ['campus','Campus'],
                  ['area','Área'],
                ] as [typeof sortBy, string][])).map(([col,label]) => (
                  <th key={col} className="py-2 pr-4">
                    <button className={`inline-flex items-center gap-1 ${sortBy===col? 'text-white': 'text-slate-300'} hover:text-white`} onClick={()=>{ setPage(1); setSortBy(col); setSortDir(d=> sortBy===col ? (d==='asc'?'desc':'asc') : 'asc'); }}>
                      <span>{label}</span>
                      {sortBy===col && <span>{sortDir==='asc'?'▲':'▼'}</span>}
                    </button>
                  </th>
                ))}
                <th className="py-2 pr-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleBadge = {
                  'admin': 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30',
                  'director_campus': 'bg-sky-500/20 text-sky-200 border border-sky-400/30',
                  'director_facultad': 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30',
                  'usuario': 'bg-slate-400/10 text-slate-200 border border-white/10'
                }[u.role];
                const phone = (u as any).mobile as string | undefined;
                const wa = phone ? `https://wa.me/${String(phone).replace(/\D/g,'')}` : undefined;
                const email = (u as any).email as string | undefined;
                return (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-slate-100">{u.full_name}</td>
                    <td className="py-2 pr-4 text-slate-200">{email || '-'}</td>
                    <td className="py-2 pr-4"><span className={`px-2 py-1 rounded-full text-xs ${roleBadge}`}>{u.role.replace('_',' ')}</span></td>
                    <td className="py-2 pr-4 text-slate-200">{phone || ''}</td>
                    <td className="py-2 pr-4 text-slate-300">{(u as any).position || ''}</td>
                    <td className="py-2 pr-4 text-slate-300">{(u as any).campus || ''}</td>
                    <td className="py-2 pr-4 text-slate-300">{(u as any).area || ''}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2 justify-end">
                        {email && <button onClick={() => navigator.clipboard.writeText(email)} className="text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10" title="Copiar correo">Copiar correo</button>}
                        {phone && <button onClick={() => navigator.clipboard.writeText(phone)} className="text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10" title="Copiar móvil">Copiar móvil</button>}
                        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-white px-2 py-1 rounded text-xs" style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)'}}>WhatsApp</a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <span>Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
            <select value={pageSize} onChange={e=>{ setPage(1); setPageSize(Number(e.target.value)); }} className="bg-white/10 border border-white/20 text-slate-100 rounded px-2 py-1 text-xs">
              {[10,20,50].map(n => <option key={n} value={n}>{n}/página</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1 rounded bg-white/10 border border-white/20 text-slate-100 disabled:opacity-40">Anterior</button>
            <button onClick={()=> setPage(p => (p*pageSize >= total ? p : p+1))} disabled={page*pageSize >= total} className="px-3 py-1 rounded bg-white/10 border border-white/20 text-slate-100 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersAdminView;
