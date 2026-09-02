import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';
import { styles } from './src/styles';

const style=document.createElement('style'); style.textContent=styles; document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
