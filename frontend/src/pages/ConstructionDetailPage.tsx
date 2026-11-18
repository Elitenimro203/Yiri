import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SessionTimer from '../components/SessionTimer';
import FilTraces from '../components/yiri/FilTraces';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';
import {
  Construction, getConstruction, mettreEnPauseConstruction, reprendreConstruction, terminerConstruction, abandonnerConstruction,
} from '../api/constructions';
import { Saison, listerSaisons } from '../api/seasons';
import { Engagement, TypeEngagement, listerEngagements, creerEngagement, modifierEngagement } from '../api/engagements';
import { Action, listerActions, creerAction } from '../api/actions';
import { Observation, listerObservations, creerObservation } from '../api/observations';
import {
  Axe, Bilan, EntreeSuivi, PILIER_LABELS, TypeDecision, listProgrammes, listAxes, getGrilleSuivi, listerMesReflexions,
} from '../api/programmes';
import { SessionTravail, getSessionActive } from '../api/sessions';
import { ApiError } from '../api/client';
import { aujourdhuiLocal } from '../lib/dates';
import { construireFil, type DecisionPourFil } from '../lib/traces';
import { LIBELLES_STATUT } from '../lib/constructions';

// Design 2a — tout ce qui concerne UNE Construction : ce que j'accepte de
// faire (Engagements), ce qui s'est passé (Actions, Observations, Décisions),
// le temps consacré (sessions). Statuts sans jugement : abandonner n'est pas
// un échec (vision §20), donc pas de couleur d'alerte.
// La grille Wakati, s'il y en a une, n'est plus modifiable (décision de
// Peniel, Design 2a) : chaque case cochée créait une trace sans date réelle.

const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TYPE_DECISION_LABELS: Record<TypeDecision, string> = {
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};

function axePourSessionTimer(c: Construction, deverrouille: boolean): Axe {
  return {
    id_axe: c.id_construction, nom: c.nom, phase_deverrouillage: null,
    ordre_affichage: c.ordre_affichage, pilier: null, jours_actifs: null, deverrouille,
  };
}

export default function ConstructionDetailPage() {
  const { id } = useParams();
  const idConstruction = Number(id);
  const [apparence] = useApparence();
  const aujourdhui = aujourdhuiLocal();

  const [construction, setConstruction] = useState<Construction | null>(null);
  const [saison, setSaison] = useState<Saison | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reflexions, setReflexions] = useState<Bilan[]>([]);
  const [axeLegacy, setAxeLegacy] = useState<Axe | null>(null);
  const [grille, setGrille] = useState<EntreeSuivi[]>([]);
  const [semaineLegacy, setSemaineLegacy] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState<SessionTravail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Noter
  const [typeNote, setTypeNote] = useState<'action' | 'observation'>('action');
  const [contenuNote, setContenuNote] = useState('');
  const [dateNote, setDateNote] = useState(aujourdhui);
  const [engagementLie, setEngagementLie] = useState<number | ''>('');

  // Nouvel Engagement
  const [formEngagement, setFormEngagement] = useState(false);
  const [descEngagement, setDescEngagement] = useState('');
  const [typeEngagement, setTypeEngagement] = useState<TypeEngagement>('recurrent');
  const [debutEngagement, setDebutEngagement] = useState(aujourdhui);

  const chargerTraces = useCallback(async () => {
    const [a, o, r] = await Promise.all([
      listerActions({ axeId: idConstruction }).catch(() => [] as Action[]),
      listerObservations({ axeId: idConstruction }).catch(() => [] as Observation[]),
      listerMesReflexions().catch(() => [] as Bilan[]),
    ]);
    setActions(a);
    setObservations(o);
    setReflexions(r.filter((b) => b.id_axe === idConstruction));
  }, [idConstruction]);

  useEffect(() => {
    async function charger() {
      const c = await getConstruction(idConstruction);
      setConstruction(c);
      const [eng, saisons] = await Promise.all([
        listerEngagements(idConstruction).catch(() => [] as Engagement[]),
        listerSaisons().catch(() => [] as Saison[]),
        chargerTraces(),
      ]);
      setEngagements(eng);
      setSaison(saisons.find((s) => s.id_saison === c.id_saison) ?? null);
      getSessionActive().then(setSessionActive).catch(() => {});

      // Historique Wakati, en lecture seule : seulement si cette
      // Construction est un ancien Axe avec une vraie grille hebdomadaire.
      try {
        const progs = await listProgrammes();
        const actif = progs.find((p) => p.statut === 'actif' && p.id_programme === c.id_saison);
        if (actif) {
          const axes = await listAxes(actif.id_programme);
          const axe = axes.find((x) => x.id_axe === idConstruction && x.pilier !== null) ?? null;
          if (axe) {
            setAxeLegacy(axe);
            setSemaineLegacy(actif.semaine_courante);
            setGrille((await getGrilleSuivi(actif.id_programme, actif.semaine_courante)).filter((e) => e.id_axe === idConstruction));
          }
        }
      } catch {
        /* l'historique Wakati est facultatif */
      }
    }
    charger()
      .catch(() => setErreur('Impossible de charger cette Construction.'))
      .finally(() => setChargement(false));
  }, [idConstruction, chargerTraces]);

  async function changerStatut(action: (id: number) => Promise<Construction>) {
    setEnCours(true);
    try {
      setConstruction(await action(idConstruction));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.detail : 'Impossible de changer le statut.');
    } finally {
      setEnCours(false);
    }
  }

  async function noter() {
    const contenu = contenuNote.trim();
    if (typeNote === 'observation' && !contenu) return;
    setEnCours(true);
    setErreur(null);
    try {
      if (typeNote === 'action') {
        await creerAction({ id_axe: idConstruction, id_engagement: engagementLie || null, date_action: dateNote, contenu: contenu || null });
      } else {
        await creerObservation({ contenu, id_axe: idConstruction });
      }
      setContenuNote('');
      setEngagementLie('');
      setDateNote(aujourdhuiLocal());
      await chargerTraces();
    } catch {
      setErreur("Impossible d'enregistrer.");
    } finally {
      setEnCours(false);
    }
  }

  async function ajouterEngagement() {
    if (!descEngagement.trim()) return;
    setEnCours(true);
    try {
      const e = await creerEngagement(idConstruction, { description: descEngagement.trim(), type: typeEngagement, date_debut: debutEngagement });
      setEngagements((prev) => [...prev, e]);
      setDescEngagement('');
      setFormEngagement(false);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.detail : "Impossible d'ajouter l'engagement.");
    } finally {
      setEnCours(false);
    }
  }

  async function basculerEngagement(e: Engagement) {
    try {
      const maj = await modifierEngagement(e.id_engagement, { actif: !e.actif });
      setEngagements((prev) => prev.map((x) => (x.id_engagement === maj.id_engagement ? maj : x)));
    } catch {
      setErreur("Impossible de modifier l'engagement.");
    }
  }

  const statut = construction?.statut ?? 'active';
  const decisions: DecisionPourFil[] = reflexions.flatMap((b) =>
    b.type_decision
      ? [{ id: b.id_bilan, dateCreation: b.date_creation, libelle: TYPE_DECISION_LABELS[b.type_decision], remarque: b.remarque, idConstruction: b.id_axe }]
      : [],
  );
  const fil = construireFil(actions, observations, decisions, 30);
  const engagementsActifs = engagements.filter((e) => e.actif);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="page-main yiri" data-yiri-theme={apparence.theme} style={{ flex: 1, width: '100%', padding: 0 }}>
        <div className="y-page">
          <Link to="/constructions" className="y-retour">← Constructions</Link>

          {chargement && <p className="y-muted">Chargement…</p>}
          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}

          {construction && (
            <>
              <header className="y-entete-page">
                <p className="y-overline">
                  {saison ? `Saison · ${saison.nom}` : 'Hors Saison'}
                  {axeLegacy?.pilier && ` · ${PILIER_LABELS[axeLegacy.pilier]}`}
                </p>
                <h1 className="y-title-sheet">{construction.nom}</h1>
                {construction.intention && <p className="y-body y-muted">{construction.intention}</p>}
                {statut !== 'active' && <span className="y-statut">{LIBELLES_STATUT[statut]}</span>}
              </header>

              {/* ---- Noter ---- */}
              <section className="y-carte-note" aria-labelledby="titre-noter">
                <h2 id="titre-noter" className="y-title-card">Qu'est-ce qui s'est passé&#8239;?</h2>
                <div className="y-segment" role="group" aria-label="Type de note">
                  <button type="button" aria-pressed={typeNote === 'action'} onClick={() => setTypeNote('action')}>Ce que j'ai fait</button>
                  <button type="button" aria-pressed={typeNote === 'observation'} onClick={() => setTypeNote('observation')}>Ce que j'ai remarqué</button>
                </div>
                <label>
                  <span className="y-sr">En quelques mots</span>
                  <input className="y-champ" value={contenuNote} onChange={(e) => setContenuNote(e.target.value)} placeholder="En quelques mots" />
                </label>
                {typeNote === 'action' && (
                  <div className="y-form-ligne">
                    <label>
                      <span className="y-sr">Date</span>
                      <input className="y-champ y-champ-petit" type="date" value={dateNote} max={aujourdhui} onChange={(e) => setDateNote(e.target.value)} />
                    </label>
                    {engagementsActifs.length > 0 && (
                      <label>
                        <span className="y-sr">Engagement lié</span>
                        <select className="y-champ y-champ-petit" value={engagementLie} onChange={(e) => setEngagementLie(e.target.value ? Number(e.target.value) : '')}>
                          <option value="">Lié à un engagement ? (facultatif)</option>
                          {engagementsActifs.map((e) => <option key={e.id_engagement} value={e.id_engagement}>{e.description}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <div className="y-form-ligne">
                  <button type="button" className="y-btn y-btn-principal" onClick={noter} disabled={enCours || (typeNote === 'observation' && !contenuNote.trim())}>Enregistrer</button>
                  <span className="y-caption y-muted">Pas besoin que ce soit parfait ni complet.</span>
                </div>
              </section>

              {/* ---- Engagements ---- */}
              <section className="y-section" aria-labelledby="titre-engagements">
                <div className="y-section-head">
                  <h2 id="titre-engagements" className="y-overline">Ce que tu acceptes de faire</h2>
                  <button type="button" className="y-btn y-btn-texte" onClick={() => setFormEngagement((v) => !v)} aria-expanded={formEngagement}>
                    {formEngagement ? 'Annuler' : '+ Engagement'}
                  </button>
                </div>
                {formEngagement && (
                  <div className="y-carte-saison">
                    <label className="y-section">
                      <span className="y-label y-muted">Ce que tu acceptes concrètement de faire</span>
                      <textarea className="y-champ y-champ-zone" value={descEngagement} onChange={(e) => setDescEngagement(e.target.value)} placeholder="Ex. 20 min de conversation, 3 fois par semaine" autoFocus />
                    </label>
                    <div className="y-form-ligne">
                      <label>
                        <span className="y-sr">Type</span>
                        <select className="y-champ y-champ-petit" value={typeEngagement} onChange={(e) => setTypeEngagement(e.target.value as TypeEngagement)}>
                          <option value="recurrent">Récurrent</option>
                          <option value="ponctuel">Ponctuel</option>
                        </select>
                      </label>
                      <label>
                        <span className="y-sr">À partir du</span>
                        <input className="y-champ y-champ-petit" type="date" value={debutEngagement} onChange={(e) => setDebutEngagement(e.target.value)} />
                      </label>
                    </div>
                    <p className="y-caption y-muted">Tu pourras le suspendre ou le reprendre à tout moment.</p>
                    <div><button type="button" className="y-btn y-btn-principal" onClick={ajouterEngagement} disabled={enCours || !descEngagement.trim()}>Ajouter</button></div>
                  </div>
                )}
                {engagements.length === 0 && !formEngagement && (
                  <p className="y-label y-muted">Pas d'engagement précis. C'est possible aussi : juste y prêter attention.</p>
                )}
                {engagements.length > 0 && (
                  <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {engagements.map((e) => (
                      <li key={e.id_engagement} className="y-engagement" data-actif={e.actif}>
                        <div>
                          <p className="y-body">{e.description}</p>
                          <p className="y-caption y-muted">
                            {e.type === 'recurrent' ? 'Récurrent' : 'Ponctuel'}
                            {!e.actif && ' · suspendu'}
                          </p>
                        </div>
                        <button type="button" className="y-btn y-btn-secondaire" onClick={() => basculerEngagement(e)}>
                          {e.actif ? 'Suspendre' : 'Reprendre'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ---- Fil ---- */}
              <section className="y-section" aria-labelledby="titre-fil-c">
                <h2 id="titre-fil-c" className="y-overline y-muted">Ce qui s'est réellement passé</h2>
                <FilTraces traces={fil} aujourdhui={aujourdhui} />
              </section>

              {/* ---- Sessions ---- */}
              <section className="y-section" aria-labelledby="titre-sessions">
                <h2 id="titre-sessions" className="y-overline y-muted">Temps consacré</h2>
                <SessionTimer
                  axe={axePourSessionTimer(construction, statut !== 'abandonnee' && statut !== 'terminee')}
                  sessionActive={sessionActive}
                  onChange={setSessionActive}
                  onError={setErreur}
                />
              </section>

              {/* ---- Statut ---- */}
              <section className="y-section" aria-labelledby="titre-statut">
                <h2 id="titre-statut" className="y-overline y-muted">Ta relation avec cette Construction</h2>
                <div className="y-actions-ligne">
                  {statut === 'active' && <button type="button" className="y-btn y-btn-secondaire" disabled={enCours} onClick={() => changerStatut(mettreEnPauseConstruction)}>Mettre en pause</button>}
                  {statut !== 'active' && <button type="button" className="y-btn y-btn-secondaire" disabled={enCours} onClick={() => changerStatut(reprendreConstruction)}>Reprendre</button>}
                  {statut !== 'terminee' && <button type="button" className="y-btn y-btn-secondaire" disabled={enCours} onClick={() => changerStatut(terminerConstruction)}>Terminer</button>}
                  {statut !== 'abandonnee' && <button type="button" className="y-btn y-btn-secondaire" disabled={enCours} onClick={() => changerStatut(abandonnerConstruction)}>Abandonner</button>}
                </div>
                <p className="y-caption y-muted">Mettre en pause ou abandonner peut être une décision juste. Rien n'est effacé.</p>
              </section>

              {/* ---- Historique Wakati (lecture seule) ---- */}
              {axeLegacy && (
                <details className="y-details">
                  <summary>Historique Wakati</summary>
                  <div className="y-section">
                    <p className="y-caption y-muted">
                      Ancienne grille de la semaine {semaineLegacy}, conservée en lecture seule. Pour noter ce qui se passe, utilise « Qu'est-ce qui s'est passé ? » plus haut.
                    </p>
                    <div className="y-grille">
                      {NOMS_JOURS.map((nom, i) => {
                        const coche = grille.some((e) => e.jour === i && e.coche);
                        return (
                          <div key={nom} className="y-grille-jour" data-coche={coche}>
                            <span>{nom}</span>
                            <span aria-label={coche ? 'cochée' : 'non cochée'}>{coche ? '✓' : '·'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
