import React from 'react';
import Icon from './Icon';

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 6h16.5M5.25 9.75h13.5v8.25a2.25 2.25 0 01-2.25 2.25H7.5a2.25 2.25 0 01-2.25-2.25V9.75z" />
  </Icon>
);

export default CalendarIcon;
