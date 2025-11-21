import { useEffect } from 'react';

export function useVersionCheck() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
          console.log('New version available, reloading...');
          window.location.reload();
        }
      });
    }
  }, []);
}
