import { useEffect, useRef, useState } from 'react';
import { useApparence } from '../../design/apparence';
import '../../design/yiri-tokens.css';
import '../../design/yiri-ui.css';
import { messageAttente, useDureeAttente } from '../../lib/attente';
import ArbreReveil, { type ArbreReveilHandle } from './ArbreReveil';

// Écran d'attente quand le serveur se réveille (jusqu'à une minute sur
// l'offre gratuite). Un arbre qui pousse — yiri, l'arbre — aux couleurs du
// thème. À la sortie, le feuillage se dissout, le fond s'efface sur la page
// qui apparaît, et le fruit rejoint la pastille de Saison s'il y en a une.

const CIBLE = '[data-yiri-cible="saison"]';
const ATTENTE_CIBLE_MS = 450;

function trouverCible(): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(CIBLE);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  // Le point de la pastille est son ::before : 14 px de marge + 3,5 px de rayon.
  return { x: r.left + 14 + 3.5, y: r.top + r.height / 2 };
}

export default function EcranReveil({ enSortie = false }: { enSortie?: boolean }) {
  const [apparence] = useApparence();
  const secondes = useDureeAttente(true);
  const { principal, loi } = messageAttente(secondes);
  const arbre = useRef<ArbreReveilHandle>(null);
  const fruit = useRef<HTMLSpanElement>(null);
  const [envol, setEnvol] = useState(false);

  useEffect(() => {
    if (!enSortie || !arbre.current || !fruit.current) return;
    const depart = arbre.current.sortir();
    const f = fruit.current;
    f.style.transition = 'none';
    f.style.left = `${depart.x}px`;
    f.style.top = `${depart.y}px`;
    setEnvol(true);

    let essais = 0;
    const id = window.setInterval(() => {
      const cible = trouverCible();
      essais += 1;
      if (!cible && essais * 50 < ATTENTE_CIBLE_MS) return;
      window.clearInterval(id);
      f.style.transition = '';
      if (cible) {
        f.style.left = `${cible.x}px`;
        f.style.top = `${cible.y}px`;
        f.classList.add('y-reveil-fruit-arrive');
      } else {
        // Pas de pastille sur cette page : le fruit s'élève et s'efface.
        f.style.top = `${depart.y - 40}px`;
        f.classList.add('y-reveil-fruit-efface');
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [enSortie]);

  return (
    <div className={`yiri y-reveil${enSortie ? ' y-reveil-sortie' : ''}`} data-yiri-theme={apparence.theme} role="status" aria-live="polite" aria-busy={!enSortie}>
      <div className="y-reveil-fond" aria-hidden="true" />
      <div className="y-reveil-corps">
        <ArbreReveil ref={arbre} />
        <div className="y-reveil-textes">
          <p className="y-accueil-marque y-reveil-marque">Yiri</p>
          <p className="y-label y-muted">{principal}</p>
          <p className="y-quote y-reveil-loi" key={loi ?? 'vide'}>{loi ?? ' '}</p>
        </div>
      </div>
      <span ref={fruit} className={`y-reveil-fruit${envol ? ' y-reveil-fruit-visible' : ''}`} aria-hidden="true" />
    </div>
  );
}
