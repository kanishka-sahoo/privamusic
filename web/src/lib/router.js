// A small history-based router: the server answers every extensionless path with the app shell.
import {useCallback, useEffect, useState} from 'react';

const listeners = new Set();

function snapshot() {
  return {path: window.location.pathname.replace(/\/+$/, '') || '/', query: new URLSearchParams(window.location.search)};
}

function notify() {
  const current = snapshot();
  for (const listener of listeners) listener(current);
}

export function navigate(to, {replace = false} = {}) {
  const target = new URL(to, window.location.href);
  if (target.href === window.location.href) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target.pathname + target.search + target.hash);
  notify();
}

// Reads the current location and re-renders on navigation and browser history moves.
export function useLocation() {
  const [location, setLocation] = useState(snapshot);
  useEffect(() => {
    listeners.add(setLocation);
    window.addEventListener('popstate', notify);
    return () => {
      listeners.delete(setLocation);
      window.removeEventListener('popstate', notify);
    };
  }, []);
  return location;
}

// Returns [value, setValue] for a single query parameter; setting it replaces history so polling and paging do not pile up entries.
export function useQueryParam(name, fallback = '') {
  const {query} = useLocation();
  const value = query.get(name) ?? fallback;
  const set = useCallback((next, {replace = true} = {}) => {
    const url = new URL(window.location.href);
    if (next === undefined || next === null || next === '' || next === fallback) url.searchParams.delete(name);
    else url.searchParams.set(name, String(next));
    navigate(url.href, {replace});
  }, [name, fallback]);
  return [value, set];
}

// Pattern segments starting with ':' capture; returns params or null.
export function matchPath(pattern, path) {
  const expected = pattern.split('/').filter(Boolean);
  const actual = path.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

export function isModifiedClick(event) {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
