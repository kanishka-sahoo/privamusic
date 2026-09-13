import {useEffect} from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — PrivaMusic` : 'PrivaMusic — Your listening library';
  }, [title]);
}
