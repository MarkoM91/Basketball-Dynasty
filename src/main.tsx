import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';

registerSW({ immediate: true });

// Public HTML is prerendered for visitors and crawlers. Render the live app afresh:
// a returning player's local save can differ from the build-time new-player screen.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
