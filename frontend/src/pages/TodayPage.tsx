import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MantraCard from '../components/MantraCard';
import { Saison, getSaisonActive } from '../api/seasons';
import { Construction, listerConstructions } from '../api/constructions';
import { Engagement, listerEngagements } from '../api/engagements';
import { Action, listerActions, creerAction } from '../api/actions';
import { Observation, listerObservations, creerObservation } from '../api/observations';
import { Bilan, TypeDecision, listerMesReflexions } from '../api/programmes';

// Nombre maximum de Constructions mises en avant dans "Aujourd'hui" — au-delà,
// on renvoie vers la page Constructions plutôt que de tout entasser ici.
const MAX_CONSTRUCTIONS_MISES_EN_AVANT = 3;

const TYPE_DECISION_LABELS: Record<TypeDecision, string> = {
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};
const DECISION_LABELS_LEGACY: Record<string, string> = { avancer: 'Avancer', consolider: 'Consolider' };

function libelleDecision(b: Bilan): string {
  if (b.type_decision) return TYPE_DECISION_LABELS[b.type_decision];
  if (b.decision) return DECISION_LABELS_LEGACY[b.decision] ?? b.decision;
  return '—';
}

export default function TodayPage() {
  // Mission 9 : Today ne dépend plus du tout de Programme/Axe/EntreeSuivi
  // (grille hebdomadaire legacy) — uniquement des API modernes
  // (`/seasons`, `/constructions`, `/engagements`, `/actions`,
  // `/observations`, `/bilans`), qui ne dépendent jamais d'une Saison ni
  // d'un verrou Wakati. La grille hebdomadaire reste consultable et
  // modifiable depuis ConstructionsPage pour les Constructions qui en ont
  // réellement une — Today ne la reprend plus (§8).
  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [engagementsParConstruction, setEngagementsParConstruction] = useState<Record<number, Engagement[]>>({});
  const [actionsRecentes, setActionsRecentes] = useState<Action[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reflexionsRecentes, setReflexionsRecentes] = useState<Bilan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [nouvelleObservation, setNouvelleObservation] = useState('');
  const [envoiObservationEnCours, setEnvoiObservationEnCours] = useState(false);

  const [formulaireOuvertPour, setFormulaireOuvertPour] = useState<number | null>(null);
  const [contenuAction, setContenuAction] = useState('');
  const [engagementChoisi, setEngagementChoisi] = useState<number | ''>('');
  const [dateAction, setDateAction] = useState(() => new Date().toISOString().slice(0, 10));
  const [envoiActionEnCours, setEnvoiActionEnCours] = useState(false);

  async function chargerActionsEtObservations() {
    const [actions, obs] = await Promise.all([
      listerActions().catch(() => [] as Action[]),
      listerObservations().catch(() => [] as Observation[]),
    ]);
    setActionsRecentes(actions.slice(0, 5));
    setObservations(obs.slice(0, 3));
  }

  useEffect(() => {
    getSaisonActive().then(setSaisonActive).catch(() => {});

    listerConstructions()
      .then(async (liste) => {
        setConstructions(liste);

        // Constructions à l'attention : ni terminées ni abandonnées — jamais
        // filtrées par "déverrouillée dans une Saison" (une Construction sans
        // Saison mérite autant l'attention qu'une autre, §6).
        const misesEnAvant = [...liste]
          .filter((c) => c.statut !== 'terminee' && c.statut !== 'abandonnee')
          .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
          .slice(0, MAX_CONSTRUCTIONS_MISES_EN_AVANT);

        const listes = await Promise.all(
          misesEnAvant.map((c) => listerEngagements(c.id_construction).catch(() => [] as Engagement[]))
        );
        const map: Record<number, Engagement[]> = {};
        misesEnAvant.forEach((c, i) => {
          // actif ≠ à faire aujourd'hui (§7) — juste ce à quoi la personne
          // s'est actuellement engagée, affiché sans injonction.
          map[c.id_construction] = listes[i].filter((e) => e.actif);
        });
        setEngagementsParConstruction(map);
      })
      .catch(() => setErreur('Impossible de charger tes Constructions.'))
      .finally(() => setChargement(false));

    chargerActionsEtObservations().catch(() => {});

    // Réflexions récentes — facultatif (§10), simple lecture, aucune
    // dépendance à une Saison (Mission 4).
    listerMesReflexions()
      .then((liste) => setReflexionsRecentes(liste.slice(0, 2)))
      .catch(() => {});
  }, []);

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

  function ouvrirFormulaire(constructionId: number) {
    setFormulaireOuvertPour(formulaireOuvertPour === constructionId ? null : constructionId);
    setContenuAction('');
    setEngagementChoisi('');
    setDateAction(new Date().toISOString().slice(0, 10));
  }

  async function handleEnregistrerAction(constructionId: number) {
    setEnvoiActionEnCours(true);
    try {
      // §5 : date_action réelle, jamais semaine/jour ; id_engagement
      // uniquement si la personne le choisit explicitement (§4 : pas de
      // rattachement forcé).
      await creerAction({
        id_axe: constructionId,
        id_engagement: engagementChoisi || null,
        date_action: dateAction,
        contenu: contenuAction.trim() || null,
      });
      setFormulaireOuvertPour(null);
      await chargerActionsEtObservations(); // apparaît aussitôt dans "Ce qui s'est passé"
    } catch {
      setErreur("Impossible d'enregistrer l'action.");
    } finally {
      setEnvoiActionEnCours(false);
    }
  }

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
          {saisonActive && (
            <p style={styles.saison}>
              Saison en cours : <strong>{saisonActive.nom}</strong> — depuis le{' '}
              {new Date(saisonActive.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
          {saisonActive?.intention && <p style={styles.intention}>{saisonActive.intention}</p>}
        </header>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {!chargement && erreur && <p style={{ color: 'var(--error)', marginBottom: 16 }}>{erreur}</p>}

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
                    <h3 style={styles.h3}>À ton attention</h3>
                  </div>
                  <Link to="/constructions" style={styles.link}>Voir toutes les constructions →</Link>
                </div>

                {constructionsMisesEnAvant.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucune Construction active pour l'instant.</p>
                ) : (
                  <div style={styles.constructionsColonne}>
                    {constructionsMisesEnAvant.map((c) => {
                      const engagements = engagementsParConstruction[c.id_construction] ?? [];
                      const formulaireOuvert = formulaireOuvertPour === c.id_construction;
                      return (
                        <article key={c.id_construction} style={styles.constructionCard}>
                          <div style={styles.constructionHead}>
                            <span style={styles.constructionNom}>{c.nom}</span>
                            <Link to="/constructions" style={styles.link}>Voir →</Link>
                          </div>
                          {c.intention && <p style={styles.constructionIntention}>{c.intention}</p>}
                          {engagements.map((e) => (
                            <p key={e.id_engagement} style={styles.engagementLine}>{e.description}</p>
                          ))}

                          {!formulaireOuvert ? (
                            <button onClick={() => ouvrirFormulaire(c.id_construction)} style={styles.enregistrerBtn}>
                              Enregistrer ce qui s'est passé
                            </button>
                          ) : (
                            <div style={styles.actionForm}>
                              <input
                                type="text"
                                value={contenuAction}
                                onChange={(e) => setContenuAction(e.target.value)}
                                placeholder="Qu'est-ce qui s'est passé ?"
                                style={styles.observationInput}
                              />
                              <div style={styles.actionFormRow}>
                                <input
                                  type="date"
                                  value={dateAction}
                                  onChange={(e) => setDateAction(e.target.value)}
                                  style={styles.dateInput}
                                />
                                {engagements.length > 0 && (
                                  <select
                                    value={engagementChoisi}
                                    onChange={(e) => setEngagementChoisi(e.target.value ? Number(e.target.value) : '')}
                                    style={styles.engagementSelect}
                                  >
                                    <option value="">Engagement (facultatif)</option>
                                    {engagements.map((e) => (
                                      <option key={e.id_engagement} value={e.id_engagement}>{e.description}</option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  onClick={() => handleEnregistrerAction(c.id_construction)}
                                  disabled={envoiActionEnCours}
                                  style={styles.observationBtn}
                                >
                                  Enregistrer
                                </button>
                                <button onClick={() => setFormulaireOuvertPour(null)} style={styles.annulerBtn}>
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
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

            {reflexionsRecentes.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <div>
                    <p style={styles.eyebrow}>Ce que tu en comprends</p>
                    <h3 style={styles.h3}>Dernières réflexions</h3>
                  </div>
                  <Link to="/reflections" style={styles.link}>Voir toutes les réflexions →</Link>
                </div>
                <div style={styles.engagementsList}>
                  {reflexionsRecentes.map((b) => (
                    <div key={b.id_bilan} style={styles.reflexionItem}>
                      {b.remarque && <p style={styles.observationContenu}>« {b.remarque} »</p>}
                      <small style={styles.observationDate}>{libelleDecision(b)}</small>
                    </div>
                  ))}
                </div>
              </>
            )}

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
  reflexionItem: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
  },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '30px 2px 12px', gap: 12, flexWrap: 'wrap' },
  h3: { margin: 0, fontSize: 16 },
  link: { fontSize: 12, color: 'var(--sprout)', textDecoration: 'none', whiteSpace: 'nowrap' },
  constructionsColonne: { display: 'flex', flexDirection: 'column', gap: 12 },
  constructionCard: {
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px',
  },
  constructionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  constructionNom: { fontWeight: 600, fontSize: 14 },
  constructionIntention: { margin: '4px 0 10px', fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' },
  enregistrerBtn: {
    marginTop: 10, background: 'none', border: '1px solid var(--sprout-dim)', color: 'var(--sprout)',
    borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600,
  },
  actionForm: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  actionFormRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  dateInput: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '6px 8px' },
  engagementSelect: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '6px 8px' },
  annulerBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' },
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
