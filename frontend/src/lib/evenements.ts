import { useEffect, useRef } from 'react';

// La feuille « Noter » est accessible depuis toutes les pages. Quand elle
// enregistre une trace, la page ouverte doit se mettre à jour : un simple
// événement navigateur suffit, sans état global.
const TRACE_AJOUTEE = 'yiri:trace-ajoutee';

export function signalerTraceAjoutee(): void {
  window.dispatchEvent(new Event(TRACE_AJOUTEE));
}

export function useTraceAjoutee(rappel: () => void): void {
  const ref = useRef(rappel);
  ref.current = rappel;
  useEffect(() => {
    const ecouteur = () => ref.current();
    window.addEventListener(TRACE_AJOUTEE, ecouteur);
    return () => window.removeEventListener(TRACE_AJOUTEE, ecouteur);
  }, []);
}
