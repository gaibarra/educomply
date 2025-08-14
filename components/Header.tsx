
import React from 'react';
import { supabase } from '../services/supabaseClient';
import type { Session, Profile, InstitutionProfileRow } from '../types';
import UserCircleIcon from './icons/UserCircleIcon';
import ArrowRightOnRectangleIcon from './icons/ArrowRightOnRectangleIcon';

interface HeaderProps {
  session: Session;
  profile: Profile | null;
  institutionProfile: InstitutionProfileRow | null;
}

const Header: React.FC<HeaderProps> = ({ profile, institutionProfile }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <header className="glass shadow-lg p-4 flex items-center z-10">
      {/* Spacer left */}
      <div className="flex-1 hidden sm:block" />
      <h1 className="flex-1 text-center text-2xl font-extrabold text-gradient truncate" title={institutionProfile?.name || 'EduComply'}>
        {institutionProfile?.name || 'EduComply'}
      </h1>
      <div className="flex-1 flex items-center justify-end space-x-4">
        <div className="relative">
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <UserCircleIcon className="h-10 w-10 text-slate-400" />
          <div>
            <p className="font-semibold text-sm text-slate-100">{profile?.full_name || 'Usuario'}</p>
            <p className="text-xs text-slate-300">{profile ? capitalize(profile.role.replace('_', ' de ')) : 'Rol no definido'}</p>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-2 text-slate-200 hover:bg-white/10 hover:text-primary rounded-full transition-colors"
            aria-label="Cerrar sesión"
          >
            <ArrowRightOnRectangleIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;