import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import { Popup } from './Popup';
import '../app/styles.css';
import './popup.css';

const root = document.getElementById('root');
if (!root) throw new Error('The popup root is missing.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  </StrictMode>,
);
