import {useCallback, useEffect, useRef, useState} from 'react';
import {api, ApiError} from '../lib/api.js';

const POLL_INTERVAL = 2000;

// Owns authentication status and the polled dashboard state.
// status: 'loading' | 'anonymous' | 'authenticated'
export function useSession() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const inFlight = useRef(null);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      try {
        const next = await api.state();
        setData(next);
        setStatus('authenticated');
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setStatus('anonymous');
        else setStatus((s) => (s === 'authenticated' ? s : 'anonymous'));
        if (e instanceof ApiError && e.status !== 401) setError(e);
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (status === 'authenticated') refresh();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh, status]);

  const login = useCallback(async (credentials) => {
    await api.login(credentials);
    if (inFlight.current) await inFlight.current;
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    setStatus('anonymous');
    setData(null);
  }, []);

  // Browser checks drive the dashboard with synthetic state.
  useEffect(() => {
    window.privamusic = {render: (next) => {setData(next); setStatus('authenticated');}};
    return () => {delete window.privamusic;};
  }, []);

  return {status, data, error, refresh, login, logout, setData};
}
