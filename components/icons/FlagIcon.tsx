import React from 'react';
import Icon from './Icon';

const FlagIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 6l18-4.5M3 6h18M3 10.5h18M3 15h18M21 4.5l-4.5 4.5L21 13.5" />
  </Icon>
);

export default FlagIcon;
