import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './tokens.css';
import { reveillerServeur } from './api/client';
import { appliquerFondDocument, lireApparence } from './design/apparence';

appliquerFondDocument(lireApparence().theme);
reveillerServeur();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
