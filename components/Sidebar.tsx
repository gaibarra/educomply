import React, { useState } from 'react';
import type { View, Profile } from '../types';
import SupportContactModal from './SupportContactModal';
import UserAdminIcon from './icons/UserAdminIcon';
import DashboardIcon from './icons/DashboardIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import AcademicCapIcon from './icons/AcademicCapIcon';
import BuildingOfficeIcon from './icons/BuildingOfficeIcon';
import ClockRewindIcon from './icons/ClockRewindIcon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  profile?: Profile | null;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  activeView: View;
  onClick: (view: View) => void;
  children: React.ReactNode;
}> = ({ view, label, activeView, onClick, children }) => (
  <li
    onClick={() => onClick(view)}
    className={`flex items-center p-3 my-1 rounded-lg cursor-pointer transition-colors duration-200 ${
      activeView === view ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {children}
    <span className="ml-4 font-medium">{label}</span>
  </li>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, profile }) => {
  const isAdmin = profile?.role === 'admin';
  const [showSupport, setShowSupport] = useState(false);
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col p-4 shadow-2xl border-r border-gray-800">
      <div className="text-center py-4 mb-4">
        <h1 className="text-2xl font-extrabold text-white">
          EduComply
        </h1>
        <p className="text-xs text-slate-300">Gestión de Cumplimiento</p>
      </div>
      <nav>
        <ul>
          <NavItem view="dashboard" label="Dashboard" activeView={activeView} onClick={setActiveView}>
            <DashboardIcon />
          </NavItem>
          {/* Proyectos movido debajo de Dashboard */}
          <NavItem view="proyectos" label="Proyectos" activeView={activeView} onClick={setActiveView}>
            <BuildingOfficeIcon />
          </NavItem>
          <NavItem view="normativas" label="Normativas" activeView={activeView} onClick={setActiveView}>
            <BookOpenIcon />
          </NavItem>
          <NavItem view="tareas" label="Tareas" activeView={activeView} onClick={setActiveView}>
            <ClipboardCheckIcon />
          </NavItem>
          <NavItem view="auditorias" label="Auditorías" activeView={activeView} onClick={setActiveView}>
            <ShieldCheckIcon />
          </NavItem>
          <NavItem view="reportes" label="Reportes" activeView={activeView} onClick={setActiveView}>
            <ChartBarIcon />
          </NavItem>
          {isAdmin && (
            <NavItem view="usuarios" label="Usuarios" activeView={activeView} onClick={setActiveView}>
              <UserAdminIcon />
            </NavItem>
          )}
          {isAdmin && (
            <NavItem view="reprogramar" label="Reprogramar tareas" activeView={activeView} onClick={setActiveView}>
              <ClockRewindIcon />
            </NavItem>
          )}
      <div className="my-4 border-t border-gray-700/50"></div>
          <NavItem view="institucion" label="Institución" activeView={activeView} onClick={setActiveView}>
            <AcademicCapIcon />
          </NavItem>
        </ul>
      </nav>
    <div className="mt-auto bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-center">
      <p className="text-sm text-slate-200">¿Necesita ayuda?</p>
      <p className="text-xs text-slate-300 mt-1">Contacte a soporte técnico para asistencia.</p>
      <button onClick={() => setShowSupport(true)} className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
        Contactar
      </button>
      </div>
      <SupportContactModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </div>
  );
};

export default Sidebar;