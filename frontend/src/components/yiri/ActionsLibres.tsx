import { useState } from 'react';
import type { Action } from '../../api/actions';
import { rattacherAction } from '../../api/actions';
import type { Construction } from '../../api/constructions';
import { libelleJourRelatif, jourCalendaire } from '../../lib/dates';

// Des Actions notées sans Construction. Yiri propose de les rattacher, sans
// jamais l'exiger : elles restent valables telles quelles.

const AFFICHEES = 3;

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
  if (actions.length === 0 || constructions.length === 0) return null;

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
      <h2 id="titre-libres" className="y-title-card">Notées librement</h2>
      <p className="y-caption y-muted">
        {actions.length === 1 ? 'Une action' : `${actions.length} actions`} sans Construction. Tu peux les rattacher si l'une d'elles y correspond, ou les laisser telles quelles.
      </p>
      <ul className="y-traj-fil" role="list">
        {actions.slice(0, AFFICHEES).map((a) => {
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
