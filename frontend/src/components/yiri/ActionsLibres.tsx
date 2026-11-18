import { useState } from 'react';
import type { Action } from '../../api/actions';
import { rattacherAction } from '../../api/actions';
import type { Construction } from '../../api/constructions';
import { libelleJourRelatif, jourCalendaire } from '../../lib/dates';

// Jour calendaire décalé de n jours (AAAA-MM-JJ), sans passer par un fuseau.
function ecartJour(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  const d = new Date(a, m - 1, j + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Des Actions notées sans Construction. Yiri propose de les rattacher, sans
// jamais l'exiger : elles restent valables telles quelles. Pour ne pas devenir
// une « tâche en attente », la carte ne montre que la dernière semaine et peut
// être masquée (elle ne revient que pour une Action notée après).

const AFFICHEES = 3;
const JOURS_RECENTS = 7;
const CLE_MASQUEE = 'yiri.libresMasqueesJusquA';

function lireMasque(): string | null {
  try { return localStorage.getItem(CLE_MASQUEE); } catch { return null; }
}

export default function ActionsLibres({
  actions, constructions, aujourdhui, onRattachee,
}: {
  actions: Action[];
  constructions: Construction[];
  aujourdhui: string;
  onRattachee: () => void;
}) {
  const [enCours, setEnCours] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [masqueeJusquA, setMasqueeJusquA] = useState<string | null>(lireMasque);

  const limite = ecartJour(aujourdhui, -JOURS_RECENTS);
  const recentes = actions.filter((a) => {
    const jour = jourCalendaire(a.date_action);
    return jour !== null && jour >= limite && (masqueeJusquA === null || (a.date_action ?? '') > masqueeJusquA);
  });
  if (recentes.length === 0 || constructions.length === 0) return null;

  function masquer() {
    const repere = recentes.reduce((max, a) => ((a.date_action ?? '') > max ? a.date_action ?? '' : max), '');
    try { localStorage.setItem(CLE_MASQUEE, repere); } catch { /* sans stockage, masqué pour cette visite */ }
    setMasqueeJusquA(repere);
  }

  async function rattacher(a: Action, idAxe: number) {
    setEnCours(a.id_entree);
    setErreur(null);
    try {
      await rattacherAction(a.id_entree, idAxe);
      onRattachee();
    } catch {
      setErreur('Impossible de rattacher cette action.');
    } finally {
      setEnCours(null);
    }
  }

  return (
    <section className="y-section y-carte-note" aria-labelledby="titre-libres">
      <div className="y-section-head">
        <h2 id="titre-libres" className="y-title-card">Notées sans Construction</h2>
        <button type="button" className="y-btn y-btn-texte" onClick={masquer}>Masquer</button>
      </div>
      <p className="y-caption y-muted">
        Si l'une d'elles fait partie de ce que tu fais progresser, tu peux la rattacher. Sinon, elle reste très bien comme ça.
      </p>
      <ul className="y-traj-fil" role="list">
        {recentes.slice(0, AFFICHEES).map((a) => {
          const jour = jourCalendaire(a.date_action);
          return (
            <li key={a.id_entree} className="y-libre">
              <span className="y-libre-texte">
                <span className="y-body">{a.contenu || 'Action'}</span>
                {jour && <span className="y-caption y-muted">{libelleJourRelatif(jour, aujourdhui)}</span>}
              </span>
              <label>
                <span className="y-sr">Rattacher « {a.contenu || 'cette action'} » à une Construction</span>
                <select
                  className="y-champ y-champ-petit"
                  value=""
                  disabled={enCours === a.id_entree}
                  onChange={(e) => e.target.value && rattacher(a, Number(e.target.value))}
                >
                  <option value="">Rattacher à…</option>
                  {constructions.map((c) => <option key={c.id_construction} value={c.id_construction}>{c.nom}</option>)}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
      {erreur && <p className="y-erreur" role="alert">{erreur}</p>}
    </section>
  );
}
