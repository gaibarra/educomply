import React from 'react';
import Icon from './Icon';

const UserAdminIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a8.25 8.25 0 1115 0v.75H4.5v-.75z" />
  </Icon>
);

export default UserAdminIcon;
