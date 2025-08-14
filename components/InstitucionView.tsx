import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Profile, InstitutionProfileRow } from '../types';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import TrashIcon from './icons/TrashIcon';

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="glass p-6 rounded-xl shadow-md border border-white/10">
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{title}</h3>
        <div className="space-y-4">{children}</div>
    </div>
);

type ObjectListPropertyKey = 'locations' | 'authorities' | 'academic_programs';

interface InstitucionViewProps {
    profile: Profile;
    institutionProfile: InstitutionProfileRow | null;
    onUpdate: (updatedProfile: InstitutionProfileRow | null) => void;
}

const InstitucionView: React.FC<InstitucionViewProps> = ({ profile, institutionProfile, onUpdate }) => {
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [phoneCodeError, setPhoneCodeError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isUserAdmin = profile.role === 'admin';

    // No local fetch, data comes from props.
    // Use local state to manage edits before passing them up.
    const [localProfile, setLocalProfile] = useState<InstitutionProfileRow | null>(institutionProfile);
    useEffect(() => {
        setLocalProfile(institutionProfile);
    }, [institutionProfile]);


    const handleFieldChange = <K extends keyof InstitutionProfileRow>(field: K, value: InstitutionProfileRow[K]) => {
        if (!isUserAdmin) return;
        setLocalProfile(prev => prev ? { ...prev, [field]: value } : null);
        setIsDirty(true);
    };

    const normalizePhoneCode = (v: string | null | undefined): string | null => {
        if (!v) return null;
        let s = String(v).trim();
        if (!s) return null;
        if (s.startsWith('00')) s = '+' + s.slice(2);
        s = s.replace(/\s/g, '');
        if (!s.startsWith('+')) s = '+' + s;
        // Basic strict validation: + followed by 1-4 digits, first digit 1-9
        const re = /^\+[1-9]\d{0,3}$/;
        if (!re.test(s)) {
            setPhoneCodeError('Formato inválido. Use por ejemplo +52, +57, +593.');
            return s; // keep normalized but invalid; will block save
        }
        setPhoneCodeError(null);
        return s;
    };

    const handleSave = async () => {
        if (!localProfile || !isUserAdmin || !isDirty) return;
        // Re-validate phone code before saving
        const normalizedCode = normalizePhoneCode(localProfile.phone_country_code);
        const re = /^\+[1-9]\d{0,3}$/;
        if (normalizedCode && !re.test(normalizedCode)) {
            setError('No se puede guardar: prefijo telefónico inválido.');
            return;
        }
        setSaving(true);
        setError(null);
        
        const updateData = {
            name: localProfile.name,
            legal_representative: localProfile.legal_representative,
            logo_url: localProfile.logo_url,
            phone_country_code: normalizedCode,
            locations: localProfile.locations,
            educational_levels: localProfile.educational_levels,
            authorities: localProfile.authorities,
            academic_programs: localProfile.academic_programs
        };

        try {
            const { error: saveError, data: savedData } = await supabase
                .from('institution_profile')
                .update(updateData)
                .eq('id', 1)
                .select()
                .single();

            if (saveError) throw saveError;
            
            // Update the app-level state with the saved data
            if (savedData) {
                 onUpdate({
                    ...savedData,
                    locations: savedData.locations || [],
                    educational_levels: savedData.educational_levels || [],
                    authorities: savedData.authorities || [],
                    academic_programs: savedData.academic_programs || [],
                });
            }
           
            setIsDirty(false);
        } catch (err: any) {
            setError(`Error al guardar los cambios: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };
    
    const addListItem = <K extends ObjectListPropertyKey>(listName: K, newItem: InstitutionProfileRow[K][number]) => {
        if (!isUserAdmin) return;
        const currentList = (localProfile?.[listName] ?? []) as InstitutionProfileRow[K];
        handleFieldChange(listName, [...currentList, newItem] as any);
    };
    
    const updateListItem = <K extends ObjectListPropertyKey>(listName: K, updatedItem: InstitutionProfileRow[K][number]) => {
        if (!isUserAdmin) return;
        const currentList = (localProfile?.[listName] ?? []) as any[];
        const newList = currentList.map(item => (item.id === (updatedItem as any).id) ? updatedItem : item);
        handleFieldChange(listName, newList as any);
    };

    const deleteListItem = <K extends ObjectListPropertyKey>(listName: K, itemId: string) => {
        if (!isUserAdmin) return;
        const currentList = (localProfile?.[listName] ?? []) as any[];
        const newList = currentList.filter(item => item.id !== itemId);
        handleFieldChange(listName, newList as any);
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !isUserAdmin) return;
        const file = event.target.files[0];
        const fileExt = file.name.split('.').pop();
        const filePath = `public/logo-${Date.now()}.${fileExt}`;

        setUploading(true);
        setError(null);

        try {
            const { error: uploadError } = await supabase.storage
                .from('institution_assets')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('institution_assets')
                .getPublicUrl(filePath);

            if (urlData.publicUrl) {
                // To avoid issues with caching, append a timestamp to the URL
                const uniqueUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
                handleFieldChange('logo_url', uniqueUrl);
            }
        } catch(err: any) {
            setError(`Error al subir el logo: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };


    const inputClasses = `w-full p-2 border rounded-md text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary ${isUserAdmin ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 cursor-not-allowed'}`;

    if (!localProfile) {
         return (
             <div className="p-8 m-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center animate-fade-in">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                    <ExclamationTriangleIcon className="h-6 w-6 text-status-warning" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-yellow-800">Perfil no encontrado</h3>
                <p className="mt-2 text-sm text-yellow-700 whitespace-pre-wrap">No se encontró un perfil para la institución. Un administrador debe configurarlo primero.</p>
            </div>
         );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Perfil de la Institución</h2>
                    <p className="text-slate-500 mt-1">Información centralizada sobre la estructura y oferta de la institución.</p>
                </div>
                {isUserAdmin && (
                    <button
                        onClick={handleSave}
                        disabled={!isDirty || saving || uploading}
                        className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-brand-secondary rounded-lg hover:bg-brand-primary transition-all shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : (uploading ? 'Subiendo logo...' : (isDirty ? 'Guardar Cambios' : 'Sin cambios'))}
                    </button>
                )}
            </div>
            {error && <div className="p-3 my-2 text-sm text-center text-red-800 bg-red-100 rounded-md">{error}</div>}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                     <InfoCard title="Información General">
                        <div>
                            <label className="text-sm font-semibold text-slate-600 mb-1 block">Nombre de la Institución</label>
                            <input type="text" value={localProfile.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} disabled={!isUserAdmin} className={inputClasses} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 mb-1 block">Representante Legal</label>
                            <input type="text" value={localProfile.legal_representative || ''} onChange={(e) => handleFieldChange('legal_representative', e.target.value)} disabled={!isUserAdmin} className={inputClasses} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 mb-1 block">Prefijo telefónico por defecto (WhatsApp)</label>
                            <input
                                type="text"
                                placeholder="+52"
                                value={localProfile.phone_country_code || ''}
                                onChange={(e) => handleFieldChange('phone_country_code', e.target.value)}
                                onBlur={(e) => handleFieldChange('phone_country_code', normalizePhoneCode(e.target.value))}
                                disabled={!isUserAdmin}
                                className={inputClasses}
                            />
                            <p className="text-xs text-slate-400 mt-1">Formato E.164 (ejemplo +52, +57). Se usa para normalizar números en enlaces de WhatsApp.</p>
                            {phoneCodeError && <p className="text-xs text-red-400 mt-1">{phoneCodeError}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 mb-1 block">Logotipo</label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center border-2 border-dashed border-white/20">
                                    {localProfile.logo_url ? (
                                        <img src={localProfile.logo_url} alt="Logotipo de la institución" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <span className="text-xs text-slate-400 text-center">Sin logo</span>
                                    )}
                                </div>
                                {isUserAdmin && (
                                    <div>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 text-sm font-semibold text-brand-secondary bg-brand-secondary/10 rounded-lg hover:bg-brand-secondary/20 disabled:opacity-50"
                                            disabled={uploading}
                                        >
                                            {uploading ? 'Subiendo...' : 'Cambiar Logo'}
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                            disabled={uploading}
                                        />
                                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP. Max 5MB.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </InfoCard>

                    <InfoCard title="Niveles Educativos">
                        {localProfile.educational_levels.map((level, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="text" value={level} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => {
                                    const newList = [...localProfile.educational_levels];
                                    newList[index] = e.target.value;
                                    handleFieldChange('educational_levels', newList);
                                }}/>
                                {isUserAdmin && <button onClick={() => handleFieldChange('educational_levels', localProfile.educational_levels.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon/></button>}
                            </div>
                        ))}
                        {isUserAdmin && <button onClick={() => handleFieldChange('educational_levels', [...localProfile.educational_levels, 'Nuevo Nivel'])} className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary"><PlusCircleIcon className="w-5 h-5"/> Agregar Nivel</button>}
                    </InfoCard>

                    <InfoCard title="Ubicaciones (Campus/Sedes)">
                         {localProfile.locations.map(loc => (
                            <div key={loc.id} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                                <input placeholder="Nombre de la sede" type="text" value={loc.name} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => updateListItem('locations', {...loc, name: e.target.value})} />
                                <textarea placeholder="Dirección completa" value={loc.address} disabled={!isUserAdmin} className={`${inputClasses} min-h-[60px]`} onChange={(e) => updateListItem('locations', {...loc, address: e.target.value})} />
                                {isUserAdmin && <button onClick={() => deleteListItem('locations', loc.id)} className="text-xs text-red-500 hover:underline">Eliminar Ubicación</button>}
                            </div>
                        ))}
                        {isUserAdmin && <button onClick={() => addListItem('locations', {id: `new-${Date.now()}`, name: '', address: ''})} className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary"><PlusCircleIcon className="w-5 h-5"/> Agregar Ubicación</button>}
                    </InfoCard>
                </div>
                <div className="space-y-8">
                     <InfoCard title="Autoridades y Estructura Administrativa">
                         {localProfile.authorities.map(auth => (
                            <div key={auth.id} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                                <input placeholder="Puesto" type="text" value={auth.position} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => updateListItem('authorities', {...auth, position: e.target.value})} />
                                <input placeholder="Nombre de la Persona" value={auth.name} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => updateListItem('authorities', {...auth, name: e.target.value})} />
                                {isUserAdmin && <button onClick={() => deleteListItem('authorities', auth.id)} className="text-xs text-red-500 hover:underline">Eliminar Autoridad</button>}
                            </div>
                        ))}
                        {isUserAdmin && <button onClick={() => addListItem('authorities', {id: `new-${Date.now()}`, position: '', name: ''})} className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary"><PlusCircleIcon className="w-5 h-5"/> Agregar Autoridad</button>}
                    </InfoCard>

                    <InfoCard title="Oferta Educativa (Nivel Superior)">
                         {localProfile.academic_programs.map(prog => (
                            <div key={prog.id} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                                <select value={prog.level} disabled={!isUserAdmin} className={`${inputClasses} appearance-none`} onChange={(e) => updateListItem('academic_programs', {...prog, level: e.target.value as any})}>
                                    <option value="Licenciatura">Licenciatura</option>
                                    <option value="Posgrado">Posgrado</option>
                                </select>
                                <input placeholder="Nombre del Programa/Carrera" type="text" value={prog.name} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => updateListItem('academic_programs', {...prog, name: e.target.value})} />
                                <input placeholder="Facultad o Escuela" value={prog.faculty} disabled={!isUserAdmin} className={inputClasses} onChange={(e) => updateListItem('academic_programs', {...prog, faculty: e.target.value})} />
                                {isUserAdmin && <button onClick={() => deleteListItem('academic_programs', prog.id)} className="text-xs text-red-500 hover:underline">Eliminar Programa</button>}
                            </div>
                        ))}
                        {isUserAdmin && <button onClick={() => addListItem('academic_programs', {id: `new-${Date.now()}`, level: 'Licenciatura', name: '', faculty: ''})} className="flex items-center gap-2 text-sm font-semibold text-brand-secondary hover:text-brand-primary"><PlusCircleIcon className="w-5 h-5"/> Agregar Programa</button>}
                    </InfoCard>
                </div>
            </div>
        </div>
    );
};

export default InstitucionView;