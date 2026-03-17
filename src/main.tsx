import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Keep StrictMode enabled; development double-mount is expected and helps catch side effects.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
