import { useEffect, useRef, useState } from 'react';

// Bouton officiel « Continuer avec Google » (Google Identity Services).
// Google impose son propre bouton (charte de marque) : on ne le redessine pas.
// Le navigateur reçoit un jeton d'identité signé, que le backend vérifie
// (/auth/google) — rien n'est jamais cru côté navigateur.

// ID client OAuth : public par nature (il est visible dans la page). Variable
// Vercel VITE_GOOGLE_CLIENT_ID si définie, sinon l'ID du projet Yiri.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '582587199644-ibt2idgvbmac0tfvv2jns9lpm0kosqq1.apps.googleusercontent.com';

const SCRIPT_GIS = 'https://accounts.google.com/gsi/client';

interface GoogleId {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

let chargementScript: Promise<void> | null = null;
function chargerScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  chargementScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_GIS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { chargementScript = null; reject(new Error('Google indisponible')); };
    document.head.appendChild(s);
  });
  return chargementScript;
}

interface Props {
  sombre: boolean;
  onJeton: (credential: string) => void;
}

export default function BoutonGoogle({ sombre, onJeton }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const rappel = useRef(onJeton);
  rappel.current = onJeton;
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    let annule = false;
    chargerScript()
      .then(() => {
        if (annule || !conteneur.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r) => rappel.current(r.credential),
        });
        window.google.accounts.id.renderButton(conteneur.current, {
          type: 'standard',
          theme: sombre ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'fr',
          width: Math.min(conteneur.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => !annule && setIndisponible(true));
    return () => { annule = true; };
  }, [sombre]);

  if (indisponible) return null; // bloqueur ou réseau : l'email reste possible
  return (
    <div className="y-auth-google">
      <div ref={conteneur} className="y-google" />
      <p className="y-auth-ou y-caption y-muted"><span>ou avec ton email</span></p>
    </div>
  );
}
