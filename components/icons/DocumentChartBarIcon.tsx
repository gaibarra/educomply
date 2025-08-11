import React from 'react';
import Icon from './Icon';

const DocumentChartBarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.5c0-.621.504-1.125 1.125-1.125H7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h-3m3 3h-3m3 3h-3m-3-9h3.75a1.125 1.125 0 011.125 1.125V15" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75h.008v.008H12V6.75z" />
  </Icon>
);

export default DocumentChartBarIcon;
