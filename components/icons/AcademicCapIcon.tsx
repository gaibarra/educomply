import React from 'react';
import Icon from './Icon';

const AcademicCapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
    <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-.062.032a59.902 59.902 0 01.062-.032zm15.482 0a59.905 59.905 0 00-2.658-.813m2.658.814l.062.032a59.902 59.902 0 00-.062-.032z" />
  </Icon>
);

export default AcademicCapIcon;
