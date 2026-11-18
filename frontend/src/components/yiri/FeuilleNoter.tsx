import { useEffect, useRef, useState } from 'react';
import { Construction, listerConstructions } from '../../api/constructions';
import { creerAction } from '../../api/actions';
import { creerObservation } from '../../api/observations';
import { aujourdhuiLocal } from '../../lib/dates';
import { estClose } from '../../lib/constructions';
import { signalerTraceAjoutee } from '../../lib/evenements';

// « Qu'est-ce qui s'est passé ? », accessible de partout (bouton + ou
// « Noter »). Ni une Action ni une Observation n'exigent de Construction
// (décision provisoire, docs/DECISIONS.md) : une trace peut exister seule,
// et être rattachée plus tard.

export default function FeuilleNoter({ onFermer }: { onFermer: () => void }) {
  const [type, setType] = useState<'action' | 'observation'>('action');
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [idConstruction, setIdConstruction] = useState<number | null>(null);
  const [contenu, setContenu] = useState('');
  const [date, setDate] = useState(aujourdhuiLocal());
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listerConstructions()
      .then((liste) => setConstructions(liste.filter((c) => !estClose(c)).sort((a, b) => a.ordre_affichage - b.ordre_affichage)))
      .catch(() => {});
    champ.current?.focus();
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    const ancienOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', echap);
      document.body.style.overflow = ancienOverflow;
    };
  }, [onFermer]);

  const texte = contenu.trim();
  const peutEnregistrer = texte.length > 0;
  const aide = constructions.length === 0
    ? "Pas besoin de Construction pour noter. Une trace peut exister seule."
    : 'Pas besoin que ce soit parfait ni complet.';

  async function enregistrer() {
    if (!peutEnregistrer) return;
    setEnvoi(true);
    setErreur(null);
    try {
      if (type === 'action') {
        await creerAction({ id_axe: idConstruction, date_action: date, contenu: texte });
      } else {
        await creerObservation({ contenu: texte, id_axe: idConstruction });
      }
      signalerTraceAjoutee();
      onFermer();
    } catch {
      setErreur("Impossible d'enregistrer. Réessaie dans un instant.");
      setEnvoi(false);
    }
  }

  return (
    <div className="y-voile" onClick={onFermer}>
      <section
        className="y-feuille"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-feuille-noter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="y-feuille-poignee" aria-hidden="true" />
        <div className="y-feuille-haut">
          <button type="button" className="y-btn y-btn-texte" onClick={onFermer}>Annuler</button>
          <button type="button" className="y-btn y-btn-principal" onClick={enregistrer} disabled={envoi || !peutEnregistrer}>
            Enregistrer
          </button>
        </div>
        <h2 id="titre-feuille-noter" className="y-title-sheet">Qu'est-ce qui s'est passé&#8239;?</h2>

        <div className="y-segment" role="group" aria-label="Type de note" aria-describedby="noter-explication">
          <button type="button" aria-pressed={type === 'action'} onClick={() => setType('action')}>Ce que j'ai fait</button>
          <button type="button" aria-pressed={type === 'observation'} onClick={() => setType('observation')}>Ce que j'ai remarqué</button>
        </div>
        <p id="noter-explication" className="y-caption y-muted">
          {type === 'action'
            ? 'Une action : quelque chose que tu as fait, même petit.'
            : "Une observation : un fait, un écart, une surprise. Ce que tu as vu, pas ce que tu as fait."}
        </p>

        {constructions.length > 0 && (
          <div className="y-section">
            <p className="y-overline y-muted">Pour quoi&#8239;? (facultatif)</p>
            <div className="y-puces" role="group" aria-label="Construction">
              {constructions.map((c) => (
                <button
                  key={c.id_construction}
                  type="button"
                  className="y-puce"
                  aria-pressed={idConstruction === c.id_construction}
                  onClick={() => setIdConstruction((id) => (id === c.id_construction ? null : c.id_construction))}
                >
                  {c.nom}
                </button>
              ))}
              <button type="button" className="y-puce" aria-pressed={idConstruction === null} onClick={() => setIdConstruction(null)}>
                Rien de précis
              </button>
            </div>
          </div>
        )}

        <label className="y-section">
          <span className="y-overline y-muted">En quelques mots</span>
          <input
            ref={champ}
            className="y-champ"
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enregistrer()}
            placeholder={type === 'action' ? 'Ex. Lu 20 pages de mon livre' : 'Ex. Je me concentre mieux le matin'}
          />
        </label>

        {type === 'action' && (
          <label className="y-form-ligne">
            <span className="y-label y-muted">Quand</span>
            <input className="y-champ y-champ-petit" type="date" value={date} max={aujourdhuiLocal()} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        {erreur ? <p className="y-erreur" role="alert">{erreur}</p> : <p className="y-caption y-muted">{aide}</p>}
      </section>
    </div>
  );
}
