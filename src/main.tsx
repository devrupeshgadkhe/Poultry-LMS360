import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { FarmProvider } from './context/FarmContext.tsx';
import './index.css';

// Global error logging function
async function logClientError(message: string, stack?: string) {
  try {
    await fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Client',
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userEmail: localStorage.getItem('userEmail') || 'Anonymous'
      })
    });
  } catch (err) {
    console.warn('Failed to dispatch client error trace to log API:', err);
  }
}

// Window level unhandled JS errors listener
window.addEventListener('error', (event) => {
  // Ignore harmless ResizeObserver or third-party extension noise
  if (event.message && (event.message.includes('ResizeObserver') || event.message.includes('Extension') || event.message.includes('websocket'))) {
    return;
  }
  logClientError(
    event.message || 'Unhandled Client Error',
    event.error?.stack || `Error at ${event.filename}:${event.lineno}:${event.colno}`
  );
});

// Window level unhandled promise rejections listener
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || String(reason || 'Unhandled Promise Rejection');
  const stack = reason?.stack || '';
  // Ignore harmless hot reload / socket disconnect errors
  if (message.includes('websocket') || message.includes('HMR')) return;
  logClientError(`Unhandled Rejection: ${message}`, stack);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FarmProvider>
        <App />
      </FarmProvider>
    </ErrorBoundary>
  </StrictMode>,
);
