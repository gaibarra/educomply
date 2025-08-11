import React from 'react';
import type { View } from '../types';
import DashboardIcon from './icons/DashboardIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import AcademicCapIcon from './icons/AcademicCapIcon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
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
      activeView === view
        ? 'bg-brand-secondary text-white shadow-lg'
        : 'text-slate-200 hover:bg-brand-secondary/50 hover:text-white'
    }`}
  >
    {children}
    <span className="ml-4 font-medium">{label}</span>
  </li>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <div className="w-64 bg-brand-primary text-white flex flex-col p-4 shadow-2xl">
      <div className="text-center py-4 mb-4">
        <h1 className="text-2xl font-bold text-white">
          Edu<span className="text-brand-accent">Comply</span>
        </h1>
        <p className="text-xs text-slate-300">Gestión de Cumplimiento</p>
      </div>
      <nav>
        <ul>
          <NavItem view="dashboard" label="Dashboard" activeView={activeView} onClick={setActiveView}>
            <DashboardIcon />
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
          <div className="my-4 border-t border-brand-secondary/30"></div>
          <NavItem view="institucion" label="Institución" activeView={activeView} onClick={setActiveView}>
            <AcademicCapIcon />
          </NavItem>
        </ul>
      </nav>
      <div className="mt-auto bg-brand-secondary/50 p-4 rounded-lg text-center">
         <p className="text-sm text-slate-200">¿Necesita ayuda?</p>
         <p className="text-xs text-slate-300 mt-1">Contacte a soporte técnico para asistencia.</p>
         <button className="mt-3 w-full bg-brand-accent text-brand-primary font-bold py-2 px-4 rounded-lg hover:bg-yellow-400 transition-colors">
            Contactar
         </button>
      </div>
    </div>
  );
};

export default Sidebar;