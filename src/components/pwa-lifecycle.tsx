"use client";

import { useEffect } from 'react';

export function PWALifecycle() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('SW cleanup failed: ', error);
        });

      if ('caches' in window) {
        void caches
          .keys()
          .then((cacheNames) =>
            Promise.all(
              cacheNames
                .filter((cacheName) => cacheName.startsWith('crapro95-cache'))
                .map((cacheName) => caches.delete(cacheName))
            )
          )
          .catch((error) => {
            console.warn('Cache cleanup failed: ', error);
          });
      }

      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
      return;
    }

    window.addEventListener('load', registerServiceWorker);
    return () => window.removeEventListener('load', registerServiceWorker);
  }, []);

  return null;
}
