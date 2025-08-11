import React from 'react';
import { TaskStatus } from '../../types';

interface StatusIconProps {
    status: TaskStatus;
    onClick: () => void;
}

const StatusIcon: React.FC<StatusIconProps> = ({ status, onClick }) => {
    const baseClasses = "h-7 w-7 transition-all duration-200";

    const statusMap: Record<TaskStatus, { icon: React.ReactNode; classes: string; label: string }> = {
        'Pendiente': {
            icon: <circle cx="12" cy="12" r="9" strokeWidth="1.5" />,
            classes: "text-slate-400 fill-white stroke-current hover:text-slate-600",
            label: "Marcar como 'En Progreso'"
        },
        'En Progreso': {
            icon: (
                <>
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" className="fill-blue-100 stroke-blue-500" />
                    <line x1="9" y1="12" x2="15" y2="12" strokeWidth="2" className="stroke-blue-500" strokeLinecap="round" />
                </>
            ),
            classes: "text-blue-500 hover:text-blue-700",
            label: "Marcar como 'Completada'"
        },
        'Completada': {
            icon: (
                 <>
                    <circle cx="12" cy="12" r="9" className="fill-green-500 stroke-green-500" />
                    <path d="M8.5 12l2.5 2.5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </>
            ),
            classes: "text-green-500 hover:text-green-600",
            label: "Marcar como 'Pendiente'"
        }
    };

    const current = statusMap[status];

    return (
        <button
            onClick={onClick}
            className="relative flex-shrink-0 z-10 bg-white"
            aria-label={current.label}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className={`${baseClasses} ${current.classes}`}
            >
                {current.icon}
            </svg>
        </button>
    );
};

export default StatusIcon;