import React from 'react';
import './src/styles/tailwind.css';
// Import self-hosted fonts (add the .woff2 files into public/fonts). Safe even if files missing.
import './public/fonts/fonts.css';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
