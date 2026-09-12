import {useCallback, useState} from 'react';

// Wraps an async handler with a busy flag and routes failures to an error callback.
export function useAsyncAction(handler, onError) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (...args) => {
    setBusy(true);
    try {
      return await handler(...args);
    } catch (e) {
      onError?.(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [handler, onError]);
  return [run, busy];
}
