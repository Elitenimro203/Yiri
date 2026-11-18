import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import EnTeteJour from '../components/yiri/EnTeteJour';
import CarteConstruction from '../components/yiri/CarteConstruction';
import FilTraces from '../components/yiri/FilTraces';
import ReglagesApparence from '../components/yiri/ReglagesApparence';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';
import { Saison, getSaisonActive } from '../api/seasons';
import { Construction, listerConstructions } from '../api/constructions';
import { Engagement, listerEngagements } from '../api/engagements';
import { Action, listerActions, creerAction } from '../api/actions';
import { Observation, listerObservations, creerObservation } from '../api/observations';
import { Bilan, TypeDecision, listerMesReflexions } from '../api/programmes';
import { aujourdhuiLocal } from '../lib/dates';
import { construireFil, derniereTrace, type DecisionPourFil } from '../lib/traces';
import { choisirPhraseDuJour } from '../lib/phraseDuJour';
import { useTraceAjoutee, ouvrirNoter } from '../lib/evenements';
import { etapeDebut, actionsLibres, accueilDejaVu, marquerAccueilVu } from '../lib/premiersJours';
import Accueil from '../components/yiri/Accueil';
import ActionsLibres from '../components/yiri/ActionsLibres';

// Nombre maximum de Constructions mises en avant dans "Aujourd'hui" — au-delà,
// on renvoie vers la page Constructions plutôt que de tout entasser ici.
const MAX_CONSTRUCTIONS_MISES_EN_AVANT = 3;
const TRACES_AFFICHEES = 6;

const TYPE_DECISION_LABELS: Record<TypeDecision, string> = {
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};
const DECISION_LABELS_LEGACY: Record<string, string> = { avancer: 'Avancer', consolider: 'Consolider' };

function libelleDecision(b: Bilan): string | null {
  if (b.type_decision) return TYPE_DECISION_LABELS[b.type_decision];
  if (b.decision) return DECISION_LABELS_LEGACY[b.decision] ?? b.decision;
  return null;
}

export default function TodayPage() {
  // Mission 9 : Today ne dépend que des API modernes (`/seasons`,
  // `/constructions`, `/engagements`, `/actions`, `/observations`, `/bilans`),
  // jamais d'une Saison ni d'un verrou Wakati.
  // Design 1 : même comportement, nouveau design system (portée `.yiri`).
  const [apparence, changerApparence] = useApparence();
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [engagementsParConstruction, setEngagementsParConstruction] = useState<Record<number, Engagement[]>>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reflexions, setReflexions] = useState<Bilan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [tracesChargees, setTracesChargees] = useState(false);
  const [accueilVu, setAccueilVu] = useState(accueilDejaVu);
  const [erreur, setErreur] = useState<string | null>(null);

  const [nouvelleObservation, setNouvelleObservation] = useState('');
  const [envoiObservationEnCours, setEnvoiObservationEnCours] = useState(false);

  const [formulaireOuvertPour, setFormulaireOuvertPour] = useState<number | null>(null);
  const [envoiActionEnCours, setEnvoiActionEnCours] = useState(false);

  const maintenant = new Date();
  const aujourdhui = aujourdhuiLocal(maintenant);

  async function chargerActionsEtObservations() {
    const [a, o] = await Promise.all([
      listerActions().catch(() => [] as Action[]),
      listerObservations().catch(() => [] as Observation[]),
    ]);
    setActions(a);
    setObservations(o);
    setTracesChargees(true);
  }

  // Une trace notée depuis la feuille « Noter » (bouton +) apparaît aussitôt.
  useTraceAjoutee(() => { chargerActionsEtObservations().catch(() => {}); });

  useEffect(() => {
    getSaisonActive().then(setSaisonActive).catch(() => {});

    listerConstructions()
      .then(async (liste) => {
        setConstructions(liste);
        // Constructions à l'attention : ni terminées ni abandonnées — jamais
        // filtrées par "déverrouillée dans une Saison" (§6).
        const misesEnAvant = [...liste]
          .filter((c) => c.statut !== 'terminee' && c.statut !== 'abandonnee')
          .sort((a, b) => a.ordre_affichage - b.ordre_affichage)
          .slice(0, MAX_CONSTRUCTIONS_MISES_EN_AVANT);
        const listes = await Promise.all(
          misesEnAvant.map((c) => listerEngagements(c.id_construction).catch(() => [] as Engagement[]))
        );
        const map: Record<number, Engagement[]> = {};
        misesEnAvant.forEach((c, i) => {
          // actif ≠ à faire aujourd'hui (§7) — affiché sans injonction.
          map[c.id_construction] = listes[i].filter((e) => e.actif);
        });
        setEngagementsParConstruction(map);
      })
      .catch(() => setErreur('Impossible de charger tes Constructions.'))
      .finally(() => setChargement(false));

    chargerActionsEtObservations().catch(() => {});
    listerMesReflexions().then(setReflexions).catch(() => {});
  }, []);

  async function handleAjouterObservation() {
    const contenu = nouvelleObservation.trim();
    if (!contenu) return;
    setEnvoiObservationEnCours(true);
    try {
      const nouvelle = await creerObservation({ contenu });
      setObservations((prev) => [nouvelle, ...prev]);
      setNouvelleObservation('');
    } catch {
      setErreur("Impossible d'enregistrer l'observation.");
    } finally {
      setEnvoiObservationEnCours(false);
    }
  }

  async function handleEnregistrerAction(
    constructionId: number,
    saisie: { contenu: string; date: string; idEngagement: number | null },
  ) {
    setEnvoiActionEnCours(true);
    try {
      // §5 : date_action réelle, jamais semaine/jour ; id_engagement
      // uniquement si la personne le choisit explicitement (§4).
      await creerAction({
        id_axe: constructionId,
        id_engagement: saisie.idEngagement,
        date_action: saisie.date,
        contenu: saisie.contenu || null,
      });
      setFormulaireOuvertPour(null);
      await chargerActionsEtObservations(); // apparaît aussitôt dans le fil
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

  const decisions: DecisionPourFil[] = useMemo(
    () =>
      reflexions.flatMap((b) => {
        const libelle = libelleDecision(b);
        return libelle ? [{ id: b.id_bilan, dateCreation: b.date_creation, libelle, remarque: b.remarque, idConstruction: b.id_axe }] : [];
      }),
    [reflexions],
  );
  const fil = construireFil(actions, observations, decisions, TRACES_AFFICHEES);
  const phrase = choisirPhraseDuJour({ aujourdhui, saison: saisonActive, observations });
  // Premiers jours : l'état se déduit des données réelles, une fois tout chargé.
  const pret = !chargement && tracesChargees;
  const etape = etapeDebut(constructions, actions, observations);
  const libres = actionsLibres(actions);
  const constructionsOuvertes = constructions.filter((c) => c.statut !== 'terminee' && c.statut !== 'abandonnee');
  const afficherAccueil = pret && etape === 'vide' && !accueilVu;

  return (
    <div style={styles.app}>
      <Sidebar />

      <main
        className="page-main yiri"
        data-yiri-theme={apparence.theme}
        style={styles.main}
      >
        <div className="y-page">
          <EnTeteJour
            date={maintenant}
            intensite={apparence.intensite}
            saison={saisonActive}
            reglagesOuverts={reglagesOuverts}
            onReglages={() => setReglagesOuverts((v) => !v)}
          />

          {reglagesOuverts && <ReglagesApparence apparence={apparence} onChange={changerApparence} />}
          {afficherAccueil && <Accueil onCommencer={() => { marquerAccueilVu(); setAccueilVu(true); }} />}

          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}
          {!pret && <p className="y-muted">Chargement…</p>}

          {pret && etape === 'vide' && (
            <>
              <section className="y-premier" aria-labelledby="titre-premier">
                <p className="y-caption y-muted">Pour commencer, une seule question.</p>
                <h2 id="titre-premier" className="y-premier-question">Qu'est-ce qui s'est passé aujourd'hui&#8239;?</h2>
                <p className="y-label y-muted">Quelque chose que tu as fait, ou que tu as remarqué. Même petit.</p>
                <div><button type="button" className="y-btn y-btn-principal" onClick={ouvrirNoter}>Noter</button></div>
              </section>
              <Link to="/constructions?choisir=1" className="y-lien-carte">
                <span className="y-caption y-muted">Quand tu seras prêt</span>
                <span className="y-body" style={{ fontWeight: 600 }}>Choisir une chose à faire évoluer →</span>
                <span className="y-label y-muted">Une capacité, une pratique, un projet, une relation… Rien ne presse.</span>
              </Link>
              <div className="y-section">
                <div className="y-fil-attente" aria-hidden="true" />
                <p className="y-caption y-muted">Ta trajectoire commencera à ta première trace.</p>
              </div>
            </>
          )}

          {pret && etape === 'premieresTraces' && (
            <>
              <section className="y-section" aria-labelledby="titre-fil">
                <div className="y-section-head">
                  <h2 id="titre-fil" className="y-overline">Ce qui s'est réellement passé</h2>
                  <Link to="/trajectory" className="y-lien">Relire ta trajectoire →</Link>
                </div>
                <FilTraces traces={fil} aujourdhui={aujourdhui} />
                {actions.length + observations.length === 1 && (
                  <p className="y-quote y-muted">Ta première trace. C'est là que commence ta trajectoire.</p>
                )}
              </section>
              <Link to="/constructions?choisir=1" className="y-lien-carte">
                <span className="y-caption y-muted">Si tu le souhaites</span>
                <span className="y-body" style={{ fontWeight: 600 }}>Faire de quelque chose une Construction →</span>
                <span className="y-label y-muted">
                  {libres.length >= 3
                    ? `Tu as noté ${libres.length} actions. Si l'une d'elles revient souvent, tu peux en faire une Construction. Ou continuer à noter librement.`
                    : 'Une chose que tu choisis de faire évoluer dans le temps. Tu peux aussi continuer à noter librement.'}
                </span>
              </Link>
            </>
          )}

          {pret && etape === 'installe' && (
            <>
            <section className="y-phrase" aria-label="Phrase du jour">
              <p className="y-caption">{phrase.titre}</p>
              <p className="y-phrase-texte">{phrase.texte}</p>
            </section>


            {(
              <section className="y-section" aria-labelledby="titre-constructions">
                <div className="y-section-head">
                  <h2 id="titre-constructions" className="y-overline">Ce que tu fais évoluer</h2>
                  {constructions.length > 0 && <Link to="/constructions" className="y-lien">Tout voir →</Link>}
                </div>

                {constructionsMisesEnAvant.length === 0 ? (
                  <Link to="/constructions" className="y-carte-note" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="y-caption y-muted">Quand tu seras prêt</span>
                    <span className="y-body" style={{ fontWeight: 600 }}>Choisir une chose à faire évoluer →</span>
                    <span className="y-label y-muted">
                      Une capacité, une pratique, un projet, une relation… Rien ne presse : tu peux aussi noter librement ce que tu remarques.
                    </span>
                  </Link>
                ) : (
                  constructionsMisesEnAvant.map((c, i) => (
                    <CarteConstruction
                      key={c.id_construction}
                      construction={c}
                      index={i}
                      engagements={engagementsParConstruction[c.id_construction] ?? []}
                      derniereTrace={derniereTrace(actions, c.id_construction)}
                      aujourdhui={aujourdhui}
                      ouverte={formulaireOuvertPour === c.id_construction}
                      onBasculer={() => setFormulaireOuvertPour((id) => (id === c.id_construction ? null : c.id_construction))}
                      onEnregistrer={(saisie) => handleEnregistrerAction(c.id_construction, saisie)}
                      envoiEnCours={envoiActionEnCours}
                    />
                  ))
                )}
              </section>
            )}

            <section className="y-section" aria-labelledby="titre-fil">
              <div className="y-section-head">
                <h2 id="titre-fil" className="y-overline">Ce qui s'est réellement passé</h2>
                <Link to="/trajectory" className="y-lien">Relire ta trajectoire →</Link>
              </div>
              <FilTraces traces={fil} aujourdhui={aujourdhui} />
            </section>

            <ActionsLibres
              actions={libres}
              constructions={constructionsOuvertes}
              aujourdhui={aujourdhui}
              onRattachee={() => { chargerActionsEtObservations().catch(() => {}); }}
            />

            <section className="y-carte-note" aria-labelledby="titre-observation">
              <h2 id="titre-observation" className="y-title-card">Qu'as-tu remarqué&#8239;?</h2>
              <label>
                <span className="y-sr">Ce que tu as remarqué</span>
                <input
                  className="y-champ"
                  type="text"
                  value={nouvelleObservation}
                  onChange={(e) => setNouvelleObservation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAjouterObservation()}
                  placeholder="Un fait, un écart, une surprise…"
                />
              </label>
              <div className="y-form-ligne">
                <button
                  type="button"
                  className="y-btn y-btn-principal"
                  onClick={handleAjouterObservation}
                  disabled={envoiObservationEnCours || !nouvelleObservation.trim()}
                >
                  Noter
                </button>
                <span className="y-caption y-muted">Pas besoin que ce soit parfait ni complet.</span>
              </div>
            </section>

            </>
          )}

          {reflexions.length > 0 && (
            <Link to="/reflections" className="y-lien">Voir tes réflexions →</Link>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, width: '100%', padding: 0 },
};
