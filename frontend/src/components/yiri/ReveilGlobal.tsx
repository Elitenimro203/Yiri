import { useEffect, useRef, useState } from 'react';
import { useAttenteServeurEnCours } from '../../lib/attenteServeur';
import EcranReveil from './EcranReveil';

// Monté une seule fois à la racine. Affiche l'écran de réveil tant que
// quelqu'un attend le serveur ; quand la réponse arrive, attend que la page
// suivante soit prête (elle se signale par data-yiri-pret), puis lui laisse
// le temps de sa sortie pendant que la page apparaît dessous. Une attente trop
// courte pour avoir été vue (l'écran apparaît après 0,5 s) finit sans transition.

const DEJA_VU_MS = 600;
// Filet de sécurité : la sortie (accéléré + envol) dure normalement < 2 s.
const SORTIE_MAX_MS = 3000;
const ATTENTE_PAGE_MAX_MS = 1500;
const PAGE_PRETE = '[data-yiri-pret="1"]';

export default function ReveilGlobal() {
  const enAttente = useAttenteServeurEnCours();
  const [etat, setEtat] = useState<'cache' | 'visible' | 'pagePrete' | 'sortie'>('cache');
  const [cle, setCle] = useState(0);
  const montage = useRef(0);

  useEffect(() => {
    if (enAttente) {
      montage.current = Date.now();
      setCle((c) => c + 1);
      setEtat('visible');
      return;
    }
    setEtat((e) => {
      if (e !== 'visible') return e;
      return Date.now() - montage.current < DEJA_VU_MS ? 'cache' : 'pagePrete';
    });
  }, [enAttente]);

  // L'arbre continue de vivre jusqu'à ce que la page soit prête à apparaître.
  useEffect(() => {
    if (etat !== 'pagePrete') return;
    const debut = Date.now();
    const id = window.setInterval(() => {
      if (document.querySelector(PAGE_PRETE) || Date.now() - debut > ATTENTE_PAGE_MAX_MS) {
        window.clearInterval(id);
        setEtat('sortie');
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [etat]);

  useEffect(() => {
    if (etat !== 'sortie') return;
    const id = window.setTimeout(() => setEtat('cache'), SORTIE_MAX_MS);
    return () => window.clearTimeout(id);
  }, [etat]);

  if (etat === 'cache') return null;
  return <EcranReveil key={cle} enSortie={etat === 'sortie'} onFini={() => setEtat('cache')} />;
}
