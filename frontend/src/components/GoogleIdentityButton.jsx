import { useEffect, useRef } from 'react';

export default function GoogleIdentityButton({ clientId, onCredential, onError }) {
  const container = useRef(null);
  const callback = useRef(onCredential);
  const reportError = useRef(onError);
  useEffect(() => { callback.current = onCredential; reportError.current = onError; }, [onCredential, onError]);
  useEffect(() => {
    let cancelled = false;
    const mountButton = () => {
      if (cancelled || !container.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try { await callback.current(credential); }
          catch (error) { reportError.current?.(error); }
        }
      });
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320
      });
    };
    let script = document.querySelector('script[data-google-identity]');
    if (window.google?.accounts?.id) mountButton();
    else if (script) script.addEventListener('load', mountButton, { once: true });
    else {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.addEventListener('load', mountButton, { once: true });
      script.addEventListener('error', () => reportError.current?.(new Error('No se pudo cargar el acceso de Google.')), { once: true });
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [clientId]);
  return <div ref={container} className="google-signin-button" />;
}
