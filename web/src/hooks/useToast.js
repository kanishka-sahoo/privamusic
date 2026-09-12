import {useCallback, useEffect, useState} from 'react';

const TOAST_DURATION = 6000;

// A single dismissable message that clears itself.
export function useToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((error) => setToast(error?.message ? {id: Date.now(), text: error.message} : null), []);
  const dismiss = useCallback(() => setToast(null), []);
  return {toast, show, dismiss};
}
