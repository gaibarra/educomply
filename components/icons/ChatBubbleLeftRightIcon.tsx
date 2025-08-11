import React from 'react';
import Icon from './Icon';

const ChatBubbleLeftRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.537a5.25 5.25 0 01-4.756-4.756l.537-3.722c.09-1.133 1.057-1.98 2.193-1.98H16.5c.969 0 1.813.616 2.097 1.5M15.25 10.5h.008v.008h-.008V10.5zm.75 2.25h.008v.008h-.008v-.008zm.75 2.25h.008v.008h-.008v-.008zm-3.75-5.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.75 2.25h.008v.008h-.008v-.008zm-3.75-5.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.75 2.25h.008v.008h-.008v-.008zM3 8.25a2.25 2.25 0 012.25-2.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 013 17.25V8.25z" />
  </Icon>
);

export default ChatBubbleLeftRightIcon;
