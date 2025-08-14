import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Profile } from '../types';

interface SupportContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sanitizePhone = (mobile?: string | null) => (mobile || '').replace(/\D/g, '');

const SupportContactModal: React.FC<SupportContactModalProps> = ({ isOpen, onClose }) => {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchAdmins = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, scope_entity, mobile, position, campus, area')
          .eq('role', 'admin')
          .order('full_name');
        if (error) throw error;
        setAdmins((data as unknown as Profile[]) || []);
      } catch (err: any) {
        setError(err?.message || 'No se pudieron cargar los administradores.');
      } finally {
        setLoading(false);
      }
    };
    fetchAdmins();
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // noop
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-xl glass border border-white/10 rounded-2xl shadow-2xl p-6 animate-slide-up-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-100">Soporte Técnico</h3>
            <p className="text-slate-300 text-sm">Contacte a un administrador para asistencia.</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-400/20 rounded-lg p-4 text-rose-200 text-sm">{error}</div>
        ) : admins.length === 0 ? (
          <div className="text-slate-300 text-sm">No hay administradores registrados.</div>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {admins.map((a) => {
              const phone = sanitizePhone(a.mobile);
              const wa = phone ? `https://wa.me/${phone}` : undefined;
              return (
                <li key={a.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-slate-100 font-semibold">{a.full_name}</p>
                      <p className="text-slate-300 text-sm">
                        {a.position ? a.position : 'Administrador'}{a.area ? ` · ${a.area}` : ''}{a.campus ? ` · ${a.campus}` : ''}
                      </p>
                      {a.scope_entity && (
                        <p className="text-slate-400 text-xs mt-0.5">Entidad: {a.scope_entity}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {a.mobile ? (
                        <>
                          <span className="text-slate-2 00 text-sm bg-white/10 rounded px-2 py-1">{a.mobile}</span>
                          <button onClick={() => copy(a.mobile!)} className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10" title="Copiar número">Copiar</button>
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-white font-semibold px-3 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)'}}>
                              WhatsApp
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-sm italic">Teléfono no disponible</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="text-white font-semibold px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'}}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default SupportContactModal;
