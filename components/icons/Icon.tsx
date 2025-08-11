import React from 'react';

interface IconProps {
  className?: string;
  children: React.ReactNode;
}

const Icon: React.FC<IconProps> = ({ className = 'w-6 h-6', children }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    {children}
  </svg>
);

export default Icon;
