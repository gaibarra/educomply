import React from 'react';
import type { Profile } from '../types';
import AdminSuspendedTasks from './AdminSuspendedTasks';

const AdminReprogramView: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold mb-4 text-slate-100">Reprogramar Tareas (Admin)</h1>
      <AdminSuspendedTasks />
    </div>
  );
};

export default AdminReprogramView;
