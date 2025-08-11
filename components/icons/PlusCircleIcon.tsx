import React from 'react';
import Icon from './Icon';

const PlusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </Icon>
);

export default PlusCircleIcon;
