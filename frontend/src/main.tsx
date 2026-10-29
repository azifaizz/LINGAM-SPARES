// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- THIS IS THE CRUCIAL FIX ---
// This line imports the firebase configuration and runs the initializeApp function
// before any other part of your application.
import '@/lib/firebase';
// -------------------------------

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('Unregistering service worker:', registration);
      registration.unregister();
    }
  });
}

// Clean up legacy GST localStorage entries
try {
  ['gstNumber', 'gstNumber_v2', 'gstNumber_v3'].forEach(k => localStorage.removeItem(k));
  const v4 = localStorage.getItem('gstNumber_v4');
  if (v4 && (v4.includes('33JPNPK3337F1ZR') || v4.includes('YOUR_GST_NUMBER_HERE'))) {
    localStorage.removeItem('gstNumber_v4');
  }
} catch (e) {
  // ignore
}

// Clean up all legacy Raju Electricals cache and old CRM data from localStorage
try {
  const legacyKeysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('RAJU_') || key.toLowerCase().includes('raju'))) {
      legacyKeysToRemove.push(key);
    }
  }
  legacyKeysToRemove.forEach((k) => localStorage.removeItem(k));
  if (legacyKeysToRemove.length > 0) {
    console.log('[Lingam Spares] Purged legacy CRM cache keys:', legacyKeysToRemove);
  }
} catch (e) {
  // ignore
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
