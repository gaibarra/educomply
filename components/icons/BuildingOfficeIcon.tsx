import React from 'react';
import Icon from './Icon';

const BuildingOfficeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6.75M9 11.25h6.75M9 15.75h6.75M9 21v-2.25a2.25 2.25 0 00-2.25-2.25H5.25v4.5H7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 21v-2.25a2.25 2.25 0 012.25-2.25h1.5v4.5H17.25" />
  </Icon>
);

export default BuildingOfficeIcon;
