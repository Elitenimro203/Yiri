import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import RitualToday from '../components/RitualToday';
import MantraCard from '../components/MantraCard';
import {
  Programme,
  Axe,
  EntreeSuivi,
  listProgrammes,
  listAxes,
  getGrilleSuivi,
  toggleCase,
} from '../api/programmes';
import { Saison, getSaisonActive } from '../api/seasons';
import { Construction, listerConstructions } from '../api/constructions';
import { Engagement, listerEngagements } from '../api/engagements';
import { Action, listerActions } from '../api/actions';
import { Observation, listerObservations, creerObservation } from '../api/observations';
import { ApiError } from '../api/client';

function jourIndexAujourdhui(): number {
  const jsDay = new Date().getDay(); // 0 = dimanche
  return (jsDay + 6) % 7; // 0 = lundi ... 6 = dimanche
}

// Nombre maximum de Constructions mises en avant dans "Aujourd'hui" — au-delà,
// on renvoie vers la page Constructions plutôt que de tout entasser ici.
const MAX_CONSTRUCTIONS_MISES_EN_AVANT = 3;

export default function TodayPage() {
  // Mission 6 §15 : TodayPage doit fonctionner AVEC ou SANS Saison active.
  // `programme`/`axes`/`entreesSemaine` ne servent plus qu'à la grille
  // hebdomadaire legacy (RitualToday) — tout le reste (Constructions,
  // Engagements, Actions, Observations) se base sur les API modernes
  // (`/constructions`, `/actions`), qui ne dépendent jamais d'une Saison.
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [axes, setAxes] = useState<Axe[]>([]);
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [engagementsPertinents, setEngagementsPertinents] = useState<Engagement[]>([]);
  const [actionsRecentes, setActionsRecentes] = useState<Action[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toggleEnCours, setToggleEnCours] = useState<number | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [nouvelleObservation, setNouvelleObservation] = useState('');
  const [envoiObservationEnCours, setEnvoiObservationEnCours] = useState(false);

  const jourIdx = jourIndexAujourdhui();

  const chargerGrilleHebdo = useCallback(async (prog: Programme) => {
    const [axesData, entreesData] = await Promise.all([
      listAxes(prog.id_programme),
      getGrilleSuivi(prog.id_programme, prog.semaine_courante),
    ]);
    setAxes(axesData);
    setEntreesSemaine(entreesData);
  }, []);

  useEffect(() => {
    getSaisonActive().then(setSaisonActive).catch(() => {});

    listProgrammes()
      .then((programmes) => {
        const actif = programmes.find((p) => p.statut === 'actif') ?? null;
        setProgramme(actif);
        if (actif) return chargerGrilleHebdo(actif);
      })
      .catch(() => {});

    listerConstructions()
      .then(async (liste) => {
        setConstructions(liste);

        // Constructions prioritaires : celles qui ne sont ni terminées ni
        // abandonnées (une Construction historique sans statut est traitée
        // comme active), triées par ordre d'affichage — jamais filtrées par
        // "déverrouillée dans une Saison" (§11 : Saison n'est pas un
        // prérequis technique).
        const misesEnAvant = [...liste]
          .filter((c) => c.statut !== 'terminee' && c.statut !== 'abandonnee')
          .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
          .slice(0, MAX_CONSTRUCTIONS_MISES_EN_AVANT);

        const listesEngagements = await Promise.all(
          misesEnAvant.map((c) => listerEngagements(c.id_construction).catch(() => [] as Engagement[]))
        );
        setEngagementsPertinents(listesEngagements.flat().filter((e) => e.actif));
      })
      .catch(() => setErreur('Impossible de charger tes Constructions.'))
      .finally(() => setChargement(false));

    // Actions récentes — indépendant de toute Saison (Mission 6).
    listerActions()
      .then((liste) => setActionsRecentes(liste.slice(0, 5)))
      .catch(() => {});

    // Observations — indépendant du programme (une Observation peut exister
    // sans Construction ni Action, voir Mission 3), chargé à part.
    listerObservations()
      .then((liste) => setObservations(liste.slice(0, 3)))
      .catch(() => {});
  }, [chargerGrilleHebdo]);

  async function handleToggle(axeId: number) {
    if (!programme) return;
    setToggleEnCours(axeId);
    try {
      await toggleCase(axeId, programme.semaine_courante, jourIdx);
      await chargerGrilleHebdo(programme);
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        setErreur(err.detail);
      } else {
        setErreur("Impossible d'enregistrer — réessaie.");
      }
    } finally {
      setToggleEnCours(null);
    }
  }

  async function handleAjouterObservation() {
    const contenu = nouvelleObservation.trim();
    if (!contenu) return;
    setEnvoiObservationEnCours(true);
    try {
      const nouvelle = await creerObservation({ contenu });
      setObservations((prev) => [nouvelle, ...prev].slice(0, 3));
      setNouvelleObservation('');
    } catch {
      setErreur("Impossible d'enregistrer l'observation.");
    } finally {
      setEnvoiObservationEnCours(false);
    }
  }

  const axesDeverrouilles = axes.filter((a) => a.deverrouille);
  const constructionsMisesEnAvant = [...constructions]
    .filter((c) => c.statut !== 'terminee' && c.statut !== 'abandonnee')
    .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
    .slice(0, MAX_CONSTRUCTIONS_MISES_EN_AVANT);

  return (
    <div style={styles.app}>
      <Sidebar />

      <main className="page-main" style={styles.main}>
        <header style={styles.topbar}>
          <p style={styles.dateLabel}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <h1 style={styles.h1}>Qu'est-ce qui mérite ton attention aujourd'hui ?</h1>
          {programme && (
            <p style={styles.saison}>
              Saison en cours : <strong>{programme.nom}</strong> — depuis le{' '}
              {new Date(programme.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
          {saisonActive?.intention && <p style={styles.intention}>{saisonActive.intention}</p>}
        </header>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}

        {!chargement && erreur && (
          <p style={{ color: 'var(--error)', marginBottom: 16 }}>{erreur}</p>
        )}

        {!chargement && constructions.length === 0 && (
          <article style={styles.emptyCard}>
            <p style={styles.emptyText}>Rien à faire évoluer pour l'instant.</p>
            <p style={styles.emptyQuestion}>
              Une Construction n'a pas besoin d'attendre une Saison — tu peux en créer une dès maintenant.
            </p>
            <Link to="/constructions" style={styles.emptyLink}>Aller vers Constructions →</Link>
          </article>
        )}

        {!chargement && (
          <>
            {constructions.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <div>
                    <p style={styles.eyebrow}>Ce que tu fais évoluer</p>
                    <h3 style={styles.h3}>Constructions à ton attention</h3>
                  </div>
                  <Link to="/constructions" style={styles.link}>Voir toutes les constructions →</Link>
                </div>

                {constructionsMisesEnAvant.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Aucune Construction active pour l'instant.
                  </p>
                ) : (
                  <div style={styles.constructionsList}>
                    {constructionsMisesEnAvant.map((c) => (
                      <Link to="/constructions" key={c.id_construction} style={styles.constructionCard}>
                        <span style={styles.constructionNom}>{c.nom}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {engagementsPertinents.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <div>
                    <p style={styles.eyebrow}>Ce à quoi tu t'es engagé</p>
                    <h3 style={styles.h3}>Engagements pertinents</h3>
                  </div>
                </div>
                <div style={styles.engagementsList}>
                  {engagementsPertinents.map((e) => (
                    <p key={e.id_engagement} style={styles.engagementLine}>{e.description}</p>
                  ))}
                </div>
              </>
            )}

            {programme && axesDeverrouilles.length > 0 && (
              <section style={styles.section}>
                <RitualToday
                  axesDeverrouilles={axesDeverrouilles}
                  entrees={entreesSemaine}
                  jourIndex={jourIdx}
                  onToggle={handleToggle}
                  enCoursId={toggleEnCours}
                />
              </section>
            )}

            {actionsRecentes.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <div>
                    <p style={styles.eyebrow}>Ce qui s'est réellement passé</p>
                    <h3 style={styles.h3}>Actions récentes</h3>
                  </div>
                </div>
                <div style={styles.engagementsList}>
                  {actionsRecentes.map((a) => (
                    <p key={a.id_entree} style={styles.engagementLine}>
                      {a.date_action && (
                        <small style={styles.observationDate}>
                          {new Date(a.date_action).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{' '}
                        </small>
                      )}
                      {a.contenu || 'Action réalisée'}
                    </p>
                  ))}
                </div>
              </>
            )}

            <div style={styles.sectionHead}>
              <div>
                <p style={styles.eyebrow}>Ce que tu remarques</p>
                <h3 style={styles.h3}>Observations</h3>
              </div>
            </div>
            <article style={styles.observationCard}>
              <p style={styles.observationPrompt}>Qu'as-tu remarqué ?</p>
              <div style={styles.observationFormRow}>
                <input
                  type="text"
                  value={nouvelleObservation}
                  onChange={(e) => setNouvelleObservation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAjouterObservation()}
                  placeholder="Un fait, un écart, une surprise…"
                  style={styles.observationInput}
                />
                <button
                  onClick={handleAjouterObservation}
                  disabled={envoiObservationEnCours || !nouvelleObservation.trim()}
                  style={styles.observationBtn}
                >
                  Ajouter
                </button>
              </div>

              {observations.length === 0 ? (
                <p style={styles.observationEmpty}>Rien de noté pour l'instant.</p>
              ) : (
                <div style={styles.observationList}>
                  {observations.map((o) => (
                    <div key={o.id_observation} style={styles.observationItem}>
                      <small style={styles.observationDate}>
                        {new Date(o.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </small>
                      <p style={styles.observationContenu}>« {o.contenu} »</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <div style={styles.bottom}>
              <MantraCard />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 900, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  topbar: { marginBottom: 26 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  dateLabel: { fontSize: 12, textTransform: 'capitalize', color: 'var(--text-muted)', margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 25, margin: '6px 0 8px' },
  saison: { fontSize: 12.5, color: 'var(--text-muted)', margin: 0 },
  intention: { fontSize: 12.5, color: 'var(--text)', fontStyle: 'italic', margin: '4px 0 0' },
  emptyCard: {
    background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)',
    padding: 24, marginBottom: 20,
  },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 6px' },
  emptyQuestion: { fontSize: 13.5, color: 'var(--text)', margin: '0 0 14px', maxWidth: 480 },
  emptyLink: { fontSize: 13, color: 'var(--sprout)', textDecoration: 'none', fontWeight: 600 },
  engagementsList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 },
  engagementLine: {
    margin: 0, fontSize: 13, color: 'var(--text)', padding: '8px 12px',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
  },
  section: { marginBottom: 26 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '30px 2px 12px', gap: 12, flexWrap: 'wrap' },
  h3: { margin: 0, fontSize: 16 },
  link: { fontSize: 12, color: 'var(--sprout)', textDecoration: 'none', whiteSpace: 'nowrap' },
  constructionsList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  constructionCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
    padding: '12px 14px', textDecoration: 'none', color: 'var(--text)', fontSize: 13,
  },
  constructionNom: { fontWeight: 600 },
  observationCard: {
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
    padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
  },
  observationPrompt: { margin: 0, fontSize: 13.5, color: 'var(--text)' },
  observationFormRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  observationInput: {
    flex: 1, minWidth: 200, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
  },
  observationBtn: {
    background: 'var(--sprout)', color: '#161D14', border: 'none',
    borderRadius: 8, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  observationEmpty: { color: 'var(--text-muted)', fontSize: 12.5, margin: 0 },
  observationList: { display: 'flex', flexDirection: 'column', gap: 8 },
  observationItem: { display: 'flex', gap: 10, alignItems: 'baseline', borderTop: '1px solid var(--line)', paddingTop: 8 },
  observationDate: { color: 'var(--text-muted)', fontSize: 10.5, whiteSpace: 'nowrap' },
  observationContenu: { margin: 0, fontSize: 13, color: 'var(--text)', fontStyle: 'italic' },
  bottom: { marginTop: 30, maxWidth: 480 },
};
