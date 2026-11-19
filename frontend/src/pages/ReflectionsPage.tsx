import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';
import { aujourdhuiLocal, libelleJourRelatif } from '../lib/dates';
import {
  Programme,
  Bilan,
  TypeDecision,
  listProgrammes,
  listBilans,
  creerReflexion,
  listerMesReflexions,
} from '../api/programmes';
import { Action, listerActions } from '../api/actions';
import { actionsDeLaSemaine } from '../lib/semaineCivile';
import { Construction, listerConstructions } from '../api/constructions';
import { Observation, listerObservations } from '../api/observations';
import { ApiError } from '../api/client';

const TYPE_DECISION_LABELS: Record<TypeDecision, string> = {
  continuer: 'Continuer',
  modifier: 'Modifier',
  reduire: 'Réduire',
  suspendre: 'Suspendre',
  abandonner: 'Abandonner',
  approfondir: 'Approfondir',
  ne_rien_changer: 'Ne rien changer',
};
const TYPES_DECISION: TypeDecision[] = [
  'continuer', 'approfondir', 'modifier', 'reduire', 'suspendre', 'abandonner', 'ne_rien_changer',
];
// Vocabulaire legacy — affiché uniquement dans l'historique des anciens Bilans,
// jamais proposé au choix pour une nouvelle Réflexion (§13).
const DECISION_LABELS: Record<string, string> = { avancer: 'Avancer', consolider: 'Consolider' };

function libelleDecision(b: Bilan): string {
  if (b.type_decision) return TYPE_DECISION_LABELS[b.type_decision];
  if (b.decision) return DECISION_LABELS[b.decision];
  return '—';
}

export default function ReflectionsPage() {
  const [apparence] = useApparence();
  const aujourdhui = aujourdhuiLocal();
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [bilansSemaine, setBilansSemaine] = useState<Bilan[]>([]);
  const [reflexionsLibres, setReflexionsLibres] = useState<Bilan[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [succes, setSucces] = useState(false);

  const [axeSelectionne, setAxeSelectionne] = useState<number | ''>('');
  // Le rattachement à une semaine Wakati est un choix explicite, jamais un défaut.
  const [rattacherSemaine, setRattacherSemaine] = useState(false);
  const [remarque, setRemarque] = useState('');
  const [comprehension, setComprehension] = useState('');
  const [changement, setChangement] = useState('');
  const [typeDecision, setTypeDecision] = useState<TypeDecision | null>(null);

  async function charger() {
    const [programmes, constructionsData, actionsData] = await Promise.all([
      listProgrammes().catch(() => []),
      listerConstructions().catch(() => [] as Construction[]),
      listerActions(),
    ]);
    setConstructions(constructionsData);
    setActions(actionsData);

    const actif = programmes.find((p) => p.statut === 'actif') ?? null;
    setProgramme(actif);
    if (actif) {
      const bilans = await listBilans(actif.id_programme);
      setBilansSemaine(bilans);
    } else {
      setBilansSemaine([]);
    }
    setChargement(false);
  }

  useEffect(() => {
    charger().catch(() => {
      setErreur('Impossible de charger tes réflexions.');
      setChargement(false);
    });
    // Réflexions libres (non rattachées à un Programme) — visibles à part.
    listerMesReflexions()
      .then((toutes) => setReflexionsLibres(toutes.filter((r) => r.id_programme === null)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // "Ce qui s'est passé" : observations récentes, filtrées par la
    // Construction sélectionnée si une est choisie.
    listerObservations(axeSelectionne ? { axeId: axeSelectionne } : undefined)
      .then((liste) => setObservations(liste.slice(0, 5)))
      .catch(() => {});
  }, [axeSelectionne]);

  const bilanSemaineCourante = programme
    ? bilansSemaine.find((b) => b.semaine === programme.semaine_courante)
    : undefined;

  // "Cette semaine" = semaine civile réelle, jamais la progression Wakati.
  // Logique isolée et testée dans lib/semaineCivile.ts (Mission 11).
  const nbActionsRealisees = actionsDeLaSemaine(actions, new Date(), axeSelectionne || null).length;

  async function handleSubmit() {
    if (!typeDecision) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const rattache = !!programme && rattacherSemaine && !bilanSemaineCourante;
      await creerReflexion({
        id_programme: rattache && programme ? programme.id_programme : null,
        semaine: rattache && programme ? programme.semaine_courante : null,
        id_axe: axeSelectionne || null,
        remarque: remarque || null,
        comprehension: comprehension || null,
        ajustement_semaine_suivante: changement || null,
        type_decision: typeDecision,
      });
      await charger();
      const toutes = await listerMesReflexions();
      setReflexionsLibres(toutes.filter((r) => r.id_programme === null));
      setSucces(true);
      setRemarque('');
      setComprehension('');
      setChangement('');
      setTypeDecision(null);
      setRattacherSemaine(false);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible d'enregistrer la réflexion.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="page-main yiri" data-yiri-theme={apparence.theme} data-yiri-pret={chargement ? "0" : "1"} style={{ flex: 1, width: '100%', padding: 0 }}>
        <div className="y-page">
          <header className="y-entete-page">
            <p className="y-overline">Réflexions</p>
            <h1 className="y-question">Qu'est-ce que tu en comprends&#8239;?</h1>
            <p className="y-body y-muted">Ce qui s'est passé, ce que tu remarques, ce que tu en comprends, ce que tu décides.</p>
          </header>

          {chargement && <p className="y-muted">Chargement…</p>}
          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}

          {!chargement && (
            <>
              <section className="y-section" aria-labelledby="refl-passe">
                <h2 id="refl-passe" className="y-overline y-muted">Ce qui s'est passé</h2>
                <label className="y-label y-refl-champ">
                  Construction concernée (facultatif)
                  <select
                    className="y-champ"
                    value={axeSelectionne}
                    onChange={(e) => setAxeSelectionne(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Aucune en particulier</option>
                    {constructions.map((c) => (
                      <option key={c.id_construction} value={c.id_construction}>{c.nom}</option>
                    ))}
                  </select>
                </label>
                <p className="y-body">
                  {nbActionsRealisees} action{nbActionsRealisees !== 1 ? 's' : ''} notée{nbActionsRealisees !== 1 ? 's' : ''} cette semaine
                  {axeSelectionne ? ' pour cette Construction' : ''}.
                </p>
                {observations.length > 0 && (
                  <ul className="y-traj-fil" role="list" aria-label="Observations récentes">
                    {observations.map((o) => (
                      <li key={o.id_observation} className="y-trace">
                        <span className="y-glyphe y-glyphe-observation" aria-hidden="true" />
                        <span className="y-caption y-muted">{libelleJourRelatif(o.date_creation.slice(0, 10), aujourdhui)}</span>
                        <span className="y-quote">« {o.contenu} »</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="y-section y-carte-note" aria-labelledby="refl-ta">
                <h2 id="refl-ta" className="y-title-card">Ta réflexion</h2>

                <label className="y-label y-refl-champ">
                  Ce que je remarque
                  <textarea className="y-champ y-champ-zone" value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={2} />
                </label>

                <label className="y-label y-refl-champ">
                  Ce que j'en comprends
                  <span className="y-caption y-muted">Une interprétation provisoire, pas un diagnostic.</span>
                  <textarea className="y-champ y-champ-zone" value={comprehension} onChange={(e) => setComprehension(e.target.value)} rows={2} />
                </label>

                <div className="y-refl-champ">
                  <p className="y-label" id="refl-decide">Ce que je décide</p>
                  <div className="y-puces" role="radiogroup" aria-labelledby="refl-decide">
                    {TYPES_DECISION.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={typeDecision === t}
                        className="y-puce"
                        onClick={() => setTypeDecision(t)}
                      >
                        {TYPE_DECISION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="y-label y-refl-champ">
                  Ce que je change (facultatif)
                  <textarea className="y-champ y-champ-zone" value={changement} onChange={(e) => setChangement(e.target.value)} rows={2} />
                </label>

                {programme && !bilanSemaineCourante && (
                  <label className="y-caption y-refl-case">
                    <input type="checkbox" checked={rattacherSemaine} onChange={(e) => setRattacherSemaine(e.target.checked)} />
                    Rattacher à la semaine {programme.semaine_courante} du programme Wakati
                  </label>
                )}
                {programme && bilanSemaineCourante && (
                  <p className="y-caption y-muted">La semaine {programme.semaine_courante} a déjà sa réflexion. Celle-ci sera libre.</p>
                )}

                <button type="button" className="y-btn y-btn-principal" onClick={handleSubmit} disabled={envoiEnCours || !typeDecision}>
                  {envoiEnCours ? 'Enregistrement…' : 'Enregistrer la réflexion'}
                </button>
                {!typeDecision && <p className="y-caption y-muted">Choisis ce que tu décides pour enregistrer.</p>}
                {succes && <p className="y-caption" role="status">Réflexion enregistrée.</p>}
              </section>

              {reflexionsLibres.length > 0 && (
                <section className="y-section" aria-labelledby="refl-libres">
                  <h2 id="refl-libres" className="y-overline y-muted">Tes réflexions</h2>
                  <ul className="y-traj-fil" role="list">
                    {reflexionsLibres.map((r) => (
                      <li key={r.id_bilan} className="y-trace">
                        <span className="y-glyphe y-glyphe-reflexion" aria-hidden="true" />
                        <span className="y-caption y-muted">{libelleJourRelatif(r.date_creation.slice(0, 10), aujourdhui)}</span>
                        <span className="y-refl-entree">
                          <span className="y-body">{libelleDecision(r)}</span>
                          {r.remarque && <span className="y-quote">« {r.remarque} »</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {programme && bilansSemaine.length > 0 && (
                <details className="y-details">
                  <summary className="y-label">Historique Wakati · {bilansSemaine.length} semaine{bilansSemaine.length > 1 ? 's' : ''}</summary>
                  <ul className="y-traj-fil" role="list">
                    {bilansSemaine.map((b) => (
                      <li key={b.id_bilan} className="y-refl-wakati">
                        <span className="y-body">Semaine {b.semaine} · {libelleDecision(b)}</span>
                        {b.remarque && <span className="y-caption y-muted">{b.remarque}</span>}
                        {b.comprehension && <span className="y-caption y-muted">Compris : {b.comprehension}</span>}
                        {b.ajustement_semaine_suivante && <span className="y-caption y-muted">Changé : {b.ajustement_semaine_suivante}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
