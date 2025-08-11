import React from 'react';
import Icon from './Icon';

const PaperClipIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3.375 3.375 0 1112.81 8.42l-7.693 7.693a1.125 1.125 0 01-1.591-1.591l7.693-7.693a3.375 3.375 0 014.774 4.774l-10.94 10.94a4.5 4.5 0 11-6.364-6.364l7.693-7.693" />
  </Icon>
);

export default PaperClipIcon;