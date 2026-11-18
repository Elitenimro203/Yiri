import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';
import { getTrajectory, TrajectoryEvent, TypeEvenement } from '../api/trajectory';
import { Saison, getSaisonActive } from '../api/seasons';
import { Construction, listerConstructions } from '../api/constructions';
import { aujourdhuiLocal, libelleJourRelatif } from '../lib/dates';

// Design 3 — « Qu'est-ce qui a changé au fil du temps ? »
// La Trajectoire montre, met en relation, n'invente pas (vision §16) : pas
// de courbe, pas de total, pas de comparaison. Un fil daté, regroupé par mois
// puis par jour, avec un symbole par type de trace.

const TYPE_LABELS: Record<TypeEvenement, string> = {
  season_started: 'Saison commencée',
  season_ended: 'Saison terminée',
  construction_created: 'Construction choisie',
  action: 'Action',
  observation: 'Observation',
  reflection: 'Réflexion',
  decision: 'Décision',
};

// Symbole par type : point plein = Action, anneau = Observation, losange =
// Réflexion, trait = Décision, carré = début (Construction, Saison).
const GLYPHE: Record<TypeEvenement, string> = {
  action: 'action', observation: 'observation', reflection: 'reflexion', decision: 'decision',
  construction_created: 'debut', season_started: 'debut', season_ended: 'debut',
};

const DECISION_LABELS: Record<string, string> = {
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};

type Filtre = 'tout' | 'saison' | number; // number = id_construction

type Ligne =
  | { kind: 'event'; event: TrajectoryEvent }
  | { kind: 'action_group'; cle: string; constructionNom: string; actions: TrajectoryEvent[] };

// Regroupe uniquement des Actions ADJACENTES de la même Construction, dans
// une même journée. Rien n'est caché : chaque Action reste dépliable.
function construireLignes(evenements: TrajectoryEvent[]): Ligne[] {
  const lignes: Ligne[] = [];
  let i = 0;
  while (i < evenements.length) {
    const e = evenements[i];
    if (e.type === 'action' && e.construction) {
      const id = e.construction.id_construction;
      let j = i;
      const groupe: TrajectoryEvent[] = [];
      while (j < evenements.length && evenements[j].type === 'action' && evenements[j].construction?.id_construction === id) {
        groupe.push(evenements[j]);
        j++;
      }
      if (groupe.length >= 2) lignes.push({ kind: 'action_group', cle: `${id}-${e.source_id}`, constructionNom: e.construction.nom, actions: groupe });
      else lignes.push({ kind: 'event', event: e });
      i = j;
    } else {
      lignes.push({ kind: 'event', event: e });
      i++;
    }
  }
  return lignes;
}

function contenuAffiche(e: TrajectoryEvent): string | null {
  if (!e.content) return null;
  if (e.type === 'decision') return DECISION_LABELS[e.content] ?? e.content;
  if (e.type === 'observation' || e.type === 'reflection') return `« ${e.content.trim().replace(/\n\s*\n/g, "\n")} »`;
  return e.content;
}

function libelleMois(cleMois: string): string {
  const [a, m] = cleMois.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function EvenementLigne({ event }: { event: TrajectoryEvent }) {
  const contenu = contenuAffiche(event);
  const citation = event.type === 'observation' || event.type === 'reflection';
  return (
    <li className="y-traj-ligne">
      <span className={`y-glyphe y-glyphe-${GLYPHE[event.type]}`} aria-hidden="true" />
      <div className="y-traj-corps">
        <p className="y-caption y-muted">
          {TYPE_LABELS[event.type]}
          {event.construction && <> · {event.construction.nom}</>}
        </p>
        {contenu && <p className={citation ? 'y-quote' : 'y-body'}>{contenu}</p>}
      </div>
    </li>
  );
}

export default function TrajectoryPage() {
  const [apparence] = useApparence();
  const aujourdhui = aujourdhuiLocal();
  const [evenements, setEvenements] = useState<TrajectoryEvent[]>([]);
  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSaisonActive().catch(() => null), listerConstructions().catch(() => [] as Construction[])])
      .then(([saison, liste]) => {
        setSaisonActive(saison);
        setConstructions(liste);
      });
  }, []);

  useEffect(() => {
    setChargement(true);
    const params =
      filtre === 'saison' && saisonActive ? { seasonId: saisonActive.id_saison, limit: 200 }
      : typeof filtre === 'number' ? { constructionId: filtre, limit: 200 }
      : { limit: 200 };
    getTrajectory(params)
      .then((page) => { setEvenements(page.items); setErreur(null); })
      .catch(() => setErreur('Impossible de charger ta trajectoire.'))
      .finally(() => setChargement(false));
  }, [filtre, saisonActive]);

  function basculerGroupe(cle: string) {
    setGroupesOuverts((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  // Regroupement purement visuel par mois puis par jour (dates calendaires,
  // jamais `new Date(iso)` qui décalerait d'un jour selon le fuseau).
  const parJour = new Map<string, TrajectoryEvent[]>();
  for (const e of evenements) {
    const jour = e.date.slice(0, 10);
    if (!parJour.has(jour)) parJour.set(jour, []);
    parJour.get(jour)!.push(e);
  }
  const parMois = new Map<string, string[]>();
  for (const jour of parJour.keys()) {
    const mois = jour.slice(0, 7);
    if (!parMois.has(mois)) parMois.set(mois, []);
    parMois.get(mois)!.push(jour);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="page-main yiri" data-yiri-theme={apparence.theme} style={{ flex: 1, width: '100%', padding: 0 }}>
        <div className="y-page">
          <header className="y-entete-page">
            <p className="y-overline">Trajectoire</p>
            <h1 className="y-question">Qu'est-ce qui a changé au fil du temps&#8239;?</h1>
            <p className="y-body y-muted">Les traces de ce qui s'est réellement passé. Yiri les montre ; le sens, c'est toi qui le construis.</p>
          </header>

          <div className="y-puces" role="group" aria-label="Filtrer la trajectoire">
            <button type="button" className="y-puce" aria-pressed={filtre === 'tout'} onClick={() => setFiltre('tout')}>Tout</button>
            {saisonActive && (
              <button type="button" className="y-puce" aria-pressed={filtre === 'saison'} onClick={() => setFiltre('saison')}>
                Saison · {saisonActive.nom}
              </button>
            )}
            {constructions.map((c) => (
              <button
                key={c.id_construction}
                type="button"
                className="y-puce"
                aria-pressed={filtre === c.id_construction}
                onClick={() => setFiltre(c.id_construction)}
              >
                {c.nom}
              </button>
            ))}
          </div>

          <p className="y-caption y-muted y-traj-legende" aria-hidden="true">
            <span className="y-glyphe y-glyphe-action" /> Action
            <span className="y-glyphe y-glyphe-observation" /> Observation
            <span className="y-glyphe y-glyphe-reflexion" /> Réflexion
            <span className="y-glyphe y-glyphe-decision" /> Décision
            <span className="y-glyphe y-glyphe-debut" /> Début
          </p>

          {chargement && <p className="y-muted">Chargement…</p>}
          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}

          {!chargement && !erreur && evenements.length === 0 && (
            <div className="y-section">
              <div className="y-fil-attente" aria-hidden="true" />
              <p className="y-label y-muted">
                Rien à montrer pour l'instant. Ta trajectoire commencera à ta première trace : une action, une observation, une réflexion.
              </p>
            </div>
          )}

          {!chargement && [...parMois.entries()].map(([mois, jours]) => (
            <section key={mois} className="y-section" aria-label={libelleMois(mois)}>
              <h2 className="y-overline y-muted">{libelleMois(mois)}</h2>
              {jours.map((jour) => (
                <div key={jour} className="y-traj-jour">
                  <p className="y-traj-date y-caption">{libelleJourRelatif(jour, aujourdhui)}</p>
                  <ul className="y-traj-fil" role="list">
                    {construireLignes(parJour.get(jour)!).map((ligne) =>
                      ligne.kind === 'event' ? (
                        <EvenementLigne key={`${ligne.event.type}-${ligne.event.source_type}-${ligne.event.source_id}`} event={ligne.event} />
                      ) : (
                        <li key={ligne.cle} className="y-traj-ligne">
                          <span className="y-glyphe y-glyphe-action" aria-hidden="true" />
                          <div className="y-traj-corps">
                            <button
                              type="button"
                              className="y-traj-groupe"
                              aria-expanded={groupesOuverts.has(ligne.cle)}
                              onClick={() => basculerGroupe(ligne.cle)}
                            >
                              {ligne.actions.length} actions · {ligne.constructionNom} {groupesOuverts.has(ligne.cle) ? '▾' : '▸'}
                            </button>
                            {groupesOuverts.has(ligne.cle) && (
                              <ul className="y-traj-fil" role="list">
                                {ligne.actions.map((a) => <EvenementLigne key={`${a.type}-${a.source_type}-${a.source_id}`} event={a} />)}
                              </ul>
                            )}
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
