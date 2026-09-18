import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { getTrajectory, TrajectoryEvent, TypeEvenement } from '../api/trajectory';
import { Saison, getSaisonActive } from '../api/seasons';
import { Construction, listerConstructions } from '../api/constructions';

const TYPE_LABELS: Record<TypeEvenement, string> = {
  season_started: 'Saison commencée',
  season_ended: 'Saison terminée',
  construction_created: 'Construction créée',
  action: 'Action',
  observation: 'Observation',
  reflection: 'Réflexion',
  decision: 'Décision',
};

// ◆ pour ce qui relève d'une pensée (réflexion/décision), ● pour un fait
// (tout le reste) — même distinction visuelle que le mockup du cahier des
// charges (§12), rien de plus.
const TYPE_ICONE: Record<TypeEvenement, string> = {
  season_started: '●', season_ended: '●', construction_created: '●',
  action: '●', observation: '●', reflection: '◆', decision: '◆',
};

const DECISION_LABELS: Record<string, string> = {
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};

type Filtre = 'tout' | 'saison' | number; // number = id_construction

type Ligne =
  | { kind: 'event'; event: TrajectoryEvent }
  | { kind: 'action_group'; cle: string; constructionNom: string; actions: TrajectoryEvent[] };

// Regroupe uniquement des Actions ADJACENTES de la même Construction — pas
// de fenêtre temporelle arbitraire au-delà du jour (déjà le grain de
// regroupement des sections ci-dessous), jamais une Observation, une
// Réflexion, une Décision ou un événement structurel (§9). Les données ne
// sont jamais modifiées : chaque Action groupée reste listée individuellement
// dans `actions`, dépliable.
function construireLignes(evenements: TrajectoryEvent[]): Ligne[] {
  const lignes: Ligne[] = [];
  let i = 0;
  while (i < evenements.length) {
    const e = evenements[i];
    if (e.type === 'action' && e.construction) {
      const idConstruction = e.construction.id_construction;
      let j = i;
      const groupe: TrajectoryEvent[] = [];
      while (
        j < evenements.length &&
        evenements[j].type === 'action' &&
        evenements[j].construction?.id_construction === idConstruction
      ) {
        groupe.push(evenements[j]);
        j++;
      }
      if (groupe.length >= 2) {
        lignes.push({ kind: 'action_group', cle: `${idConstruction}-${i}`, constructionNom: e.construction.nom, actions: groupe });
      } else {
        lignes.push({ kind: 'event', event: e });
      }
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
  if (e.type === 'observation' || e.type === 'reflection') return `« ${e.content} »`;
  return e.content;
}

function EvenementLigne({ event }: { event: TrajectoryEvent }) {
  const contenu = contenuAffiche(event);
  return (
    <div style={styles.evenement}>
      <span style={styles.icone}>{TYPE_ICONE[event.type]}</span>
      <div>
        <p style={styles.typeLabel}>{TYPE_LABELS[event.type]}</p>
        {event.construction && <p style={styles.constructionNom}>{event.construction.nom}</p>}
        {contenu && <p style={styles.contenu}>{contenu}</p>}
      </div>
    </div>
  );
}

export default function TrajectoryPage() {
  const [evenements, setEvenements] = useState<TrajectoryEvent[]>([]);
  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSaisonActive(), listerConstructions()])
      .then(([saison, liste]) => {
        setSaisonActive(saison);
        setConstructions(liste);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setChargement(true);
    const params =
      filtre === 'saison' && saisonActive
        ? { seasonId: saisonActive.id_saison, limit: 200 }
        : typeof filtre === 'number'
        ? { constructionId: filtre, limit: 200 }
        : { limit: 200 };

    getTrajectory(params)
      .then((page) => setEvenements(page.items))
      .catch(() => setErreur('Impossible de charger ta trajectoire.'))
      .finally(() => setChargement(false));
  }, [filtre, saisonActive]);

  function toggleGroupe(cle: string) {
    setGroupesOuverts((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  // Regroupement purement visuel par jour puis par mois — les données
  // renvoyées par l'API restent une liste plate triée par date (§11).
  const parJour = new Map<string, TrajectoryEvent[]>();
  for (const e of evenements) {
    const cle = e.date.slice(0, 10);
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle)!.push(e);
  }
  const joursOrdonnes = [...parJour.keys()]; // déjà en ordre DESC, hérité du tri API

  const parMois = new Map<string, string[]>(); // "2026-09" -> ["2026-09-18", ...]
  for (const jour of joursOrdonnes) {
    const cleMois = jour.slice(0, 7);
    if (!parMois.has(cleMois)) parMois.set(cleMois, []);
    parMois.get(cleMois)!.push(jour);
  }

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Le temps long</p>
        <h1 style={styles.h1}>Trajectoire</h1>
        <p style={styles.subtitle}>Ce qui s'est passé au fil du temps.</p>

        <div style={styles.filtres}>
          <button
            onClick={() => setFiltre('tout')}
            style={{ ...styles.filtreBtn, ...(filtre === 'tout' ? styles.filtreBtnActif : {}) }}
          >
            Tout
          </button>
          {saisonActive && (
            <button
              onClick={() => setFiltre('saison')}
              style={{ ...styles.filtreBtn, ...(filtre === 'saison' ? styles.filtreBtnActif : {}) }}
            >
              Saison actuelle
            </button>
          )}
          <select
            value={typeof filtre === 'number' ? filtre : ''}
            onChange={(e) => setFiltre(e.target.value ? Number(e.target.value) : 'tout')}
            style={styles.filtreSelect}
          >
            <option value="">Construction…</option>
            {constructions.map((c) => (
              <option key={c.id_construction} value={c.id_construction}>{c.nom}</option>
            ))}
          </select>
        </div>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && evenements.length === 0 && (
          <article style={styles.emptyCard}>
            <p style={styles.emptyText}>Rien à montrer pour l'instant.</p>
            <p style={styles.emptyQuestion}>
              Cette page rassemble ce qui s'est réellement passé — actions, observations, réflexions —
              à mesure que tu avances sur tes Constructions.
            </p>
          </article>
        )}

        {!chargement &&
          [...parMois.entries()].map(([cleMois, jours]) => (
            <div key={cleMois}>
              <p style={styles.moisLabel}>
                {new Date(`${cleMois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </p>
              {jours.map((jour) => {
                const lignes = construireLignes(parJour.get(jour)!);
                return (
                  <div key={jour} style={styles.jourBloc}>
                    <p style={styles.jourLabel}>
                      {new Date(jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </p>
                    {lignes.map((ligne) =>
                      ligne.kind === 'event' ? (
                        <EvenementLigne key={`${ligne.event.type}-${ligne.event.source_type}-${ligne.event.source_id}`} event={ligne.event} />
                      ) : (
                        <div key={ligne.cle} style={styles.groupe}>
                          <button onClick={() => toggleGroupe(ligne.cle)} style={styles.groupeToggle}>
                            <span style={styles.icone}>●</span>
                            {ligne.actions.length} actions — {ligne.constructionNom}
                            <span style={styles.groupeChevron}>{groupesOuverts.has(ligne.cle) ? '▾' : '▸'}</span>
                          </button>
                          {groupesOuverts.has(ligne.cle) && (
                            <div style={styles.groupeDetail}>
                              {ligne.actions.map((a) => (
                                <EvenementLigne key={`${a.type}-${a.source_type}-${a.source_id}`} event={a} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 720, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px' },
  filtres: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 },
  filtreBtn: {
    padding: '7px 14px', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 8,
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5,
  },
  filtreBtnActif: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)', color: 'var(--sprout)' },
  filtreSelect: {
    padding: '7px 10px', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 8,
    color: 'var(--text)', fontSize: 12.5,
  },
  emptyCard: { background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 6px' },
  emptyQuestion: { fontSize: 13.5, color: 'var(--text)', margin: 0, maxWidth: 480 },
  moisLabel: {
    fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700,
    margin: '28px 0 4px', borderBottom: '1px solid var(--line)', paddingBottom: 6,
  },
  jourBloc: { marginTop: 14 },
  jourLabel: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 8px' },
  evenement: { display: 'flex', gap: 10, padding: '8px 0 8px 2px' },
  icone: { color: 'var(--sprout)', fontSize: 12, lineHeight: '20px' },
  typeLabel: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  constructionNom: { margin: '1px 0 0', fontSize: 12, color: 'var(--text-muted)' },
  contenu: { margin: '4px 0 0', fontSize: 13, color: 'var(--text)', fontStyle: 'italic', maxWidth: 560 },
  groupe: { padding: '2px 0' },
  groupeToggle: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', padding: '8px 0 8px 2px', width: '100%', textAlign: 'left',
  },
  groupeChevron: { marginLeft: 'auto', color: 'var(--text-muted)' },
  groupeDetail: { paddingLeft: 20, borderLeft: '1px solid var(--line)', marginLeft: 6 },
};
