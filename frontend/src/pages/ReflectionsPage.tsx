import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Programme,
  EntreeSuivi,
  Bilan,
  TypeDecision,
  listProgrammes,
  getGrilleSuivi,
  listBilans,
  creerReflexion,
  listerMesReflexions,
} from '../api/programmes';
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
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [bilansSemaine, setBilansSemaine] = useState<Bilan[]>([]);
  const [reflexionsLibres, setReflexionsLibres] = useState<Bilan[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [succes, setSucces] = useState(false);

  const [axeSelectionne, setAxeSelectionne] = useState<number | ''>('');
  const [rattacherSemaine, setRattacherSemaine] = useState(true);
  const [remarque, setRemarque] = useState('');
  const [comprehension, setComprehension] = useState('');
  const [changement, setChangement] = useState('');
  const [typeDecision, setTypeDecision] = useState<TypeDecision | null>(null);

  async function charger() {
    const [programmes, constructionsData] = await Promise.all([
      listProgrammes().catch(() => []),
      listerConstructions().catch(() => [] as Construction[]),
    ]);
    setConstructions(constructionsData);

    const actif = programmes.find((p) => p.statut === 'actif') ?? null;
    setProgramme(actif);
    if (actif) {
      const [entreesData, bilans] = await Promise.all([
        getGrilleSuivi(actif.id_programme, actif.semaine_courante),
        listBilans(actif.id_programme),
      ]);
      setEntreesSemaine(entreesData);
      setBilansSemaine(bilans);
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

  const nbActionsRealisees = entreesSemaine.filter((e) => e.coche).length;

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
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible d'enregistrer la réflexion.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Ce que j'en apprends</p>
        <h1 style={styles.h1}>Réflexions</h1>
        <p style={styles.subtitle}>Ce qui s'est passé → ce que tu remarques → ce que tu en comprends → ce que tu décides.</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && (
          <>
            <article style={styles.card}>
              <p style={styles.eyebrowSmall}>Ce qui s'est passé</p>
              {programme ? (
                <p style={styles.contexteLigne}>
                  {nbActionsRealisees} action{nbActionsRealisees !== 1 ? 's' : ''} réalisée{nbActionsRealisees !== 1 ? 's' : ''} cette semaine.
                </p>
              ) : (
                <p style={styles.contexteLigne}>Pas de Saison active — cette réflexion sera libre.</p>
              )}

              <label style={styles.label}>
                Construction concernée (facultatif)
                <select
                  value={axeSelectionne}
                  onChange={(e) => setAxeSelectionne(e.target.value ? Number(e.target.value) : '')}
                  style={styles.select}
                >
                  <option value="">— Aucune en particulier —</option>
                  {constructions.map((c) => (
                    <option key={c.id_construction} value={c.id_construction}>{c.nom}</option>
                  ))}
                </select>
              </label>

              {observations.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <small style={styles.observationsTitle}>Observations récentes</small>
                  {observations.map((o) => (
                    <p key={o.id_observation} style={styles.observationLine}>
                      <small style={styles.observationDate}>
                        {new Date(o.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </small>{' '}
                      « {o.contenu} »
                    </p>
                  ))}
                </div>
              )}
            </article>

            <article style={styles.card}>
              <h3 style={styles.cardTitle}>Ta réflexion</h3>

              <label style={styles.label}>
                Ce que je remarque
                <textarea style={styles.textarea} value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={2} />
              </label>

              <label style={styles.label}>
                Ce que j'en comprends <small style={styles.hintInline}>(une interprétation provisoire, pas un diagnostic)</small>
                <textarea style={styles.textarea} value={comprehension} onChange={(e) => setComprehension(e.target.value)} rows={2} />
              </label>

              <p style={styles.decisionLabel}>Ce que je décide</p>
              <div style={styles.decisionGrid}>
                {TYPES_DECISION.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeDecision(t)}
                    style={{ ...styles.decisionBtn, ...(typeDecision === t ? styles.decisionBtnActive : {}) }}
                  >
                    {TYPE_DECISION_LABELS[t]}
                  </button>
                ))}
              </div>

              <label style={styles.label}>
                Ce que je change (facultatif)
                <textarea style={styles.textarea} value={changement} onChange={(e) => setChangement(e.target.value)} rows={2} />
              </label>

              {programme && !bilanSemaineCourante && (
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={rattacherSemaine} onChange={(e) => setRattacherSemaine(e.target.checked)} />
                  Rattacher à la semaine {programme.semaine_courante} en cours
                </label>
              )}
              {programme && bilanSemaineCourante && (
                <p style={styles.hint}>La semaine {programme.semaine_courante} a déjà sa réflexion — celle-ci sera libre.</p>
              )}

              <button onClick={handleSubmit} disabled={envoiEnCours || !typeDecision} style={styles.submitBtn}>
                {envoiEnCours ? 'Enregistrement…' : 'Enregistrer la réflexion'}
              </button>
            </article>

            {succes && <p style={{ color: 'var(--sprout)', fontSize: 13, marginTop: 8 }}>Réflexion enregistrée.</p>}

            {programme && bilanSemaineCourante && (
              <article style={styles.card}>
                <p style={styles.eyebrowSmall}>Semaine {bilanSemaineCourante.semaine} — déjà réfléchie</p>
                {bilanSemaineCourante.score_snapshot !== null && (
                  <p style={styles.scoreHistorique}>Score historique à la clôture : {bilanSemaineCourante.score_snapshot}%</p>
                )}
                {bilanSemaineCourante.remarque && <p style={styles.field}><strong>Ce que j'ai remarqué :</strong> {bilanSemaineCourante.remarque}</p>}
                {bilanSemaineCourante.quoi_a_marche && <p style={styles.field}><strong>Ce qui a marché :</strong> {bilanSemaineCourante.quoi_a_marche}</p>}
                {bilanSemaineCourante.quoi_n_a_pas_marche && <p style={styles.field}><strong>Ce qui n'a pas marché :</strong> {bilanSemaineCourante.quoi_n_a_pas_marche}</p>}
                {bilanSemaineCourante.comprehension && <p style={styles.field}><strong>Ce que j'en comprends :</strong> {bilanSemaineCourante.comprehension}</p>}
                {bilanSemaineCourante.ajustement_semaine_suivante && <p style={styles.field}><strong>Ce que je change :</strong> {bilanSemaineCourante.ajustement_semaine_suivante}</p>}
                <p style={styles.decisionTag}>Ce que j'ai décidé : {libelleDecision(bilanSemaineCourante)}</p>
              </article>
            )}

            {bilansSemaine.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <p style={styles.eyebrow}>Historique</p>
                  <h3 style={styles.h3}>Tes semaines précédentes</h3>
                </div>
                <div style={styles.historyList}>
                  {bilansSemaine
                    .filter((b) => b.semaine !== programme?.semaine_courante || bilanSemaineCourante)
                    .map((b) => (
                      <div key={b.id_bilan} style={styles.historyItem}>
                        <span>Semaine {b.semaine}</span>
                        <span style={styles.historyScore}>{b.score_snapshot !== null ? `${b.score_snapshot}%` : '—'}</span>
                        <span style={styles.historyDecision}>{libelleDecision(b)}</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            {reflexionsLibres.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <p style={styles.eyebrow}>Réflexions libres</p>
                  <h3 style={styles.h3}>Pas rattachées à une semaine</h3>
                </div>
                <div style={styles.historyList}>
                  {reflexionsLibres.map((r) => (
                    <div key={r.id_bilan} style={styles.historyItemLibre}>
                      <div style={styles.historyRow}>
                        <small style={styles.observationDate}>
                          {new Date(r.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </small>
                        <span style={styles.historyDecision}>{libelleDecision(r)}</span>
                      </div>
                      {r.remarque && <p style={styles.field}>{r.remarque}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 720, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  eyebrowSmall: { fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 8px' },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 18 },
  cardTitle: { fontFamily: 'var(--serif)', fontSize: 19, margin: '0 0 18px' },
  contexteLigne: { fontSize: 13, color: 'var(--text)', margin: '0 0 14px' },
  scoreHistorique: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 14px' },
  field: { fontSize: 13, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.5 },
  decisionTag: { fontSize: 12, color: 'var(--text-muted)', marginTop: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 },
  hintInline: { fontWeight: 400, fontStyle: 'italic' },
  hint: { color: 'var(--text-muted)', fontSize: 11.5, margin: '0 0 14px', fontStyle: 'italic' },
  select: {
    background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
    color: 'var(--text)', fontSize: 13,
  },
  textarea: {
    background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 10,
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
  },
  observationsTitle: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 },
  observationLine: { margin: '8px 0 0', fontSize: 12.5, color: 'var(--text)', fontStyle: 'italic' },
  observationDate: { color: 'var(--text-muted)', fontStyle: 'normal', fontSize: 10.5 },
  decisionLabel: { fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 8px' },
  decisionGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  decisionBtn: {
    padding: '8px 14px', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 8,
    color: 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
  },
  decisionBtnActive: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)', color: 'var(--sprout)' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px' },
  submitBtn: {
    width: '100%', background: 'var(--sprout)', color: '#161D14', border: 'none', borderRadius: 8,
    padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
  },
  sectionHead: { margin: '30px 2px 12px' },
  h3: { margin: 0, fontSize: 16 },
  historyList: { display: 'flex', flexDirection: 'column', gap: 8 },
  historyItem: {
    display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
    border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 10, fontSize: 13,
  },
  historyItemLibre: {
    padding: '10px 14px', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 10, fontSize: 13,
  },
  historyRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  historyScore: { color: 'var(--text-muted)', fontSize: 11.5 },
  historyDecision: { color: 'var(--text-muted)', fontSize: 11.5 },
};
