import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Programme,
  Bilan,
  DecisionBilan,
  listProgrammes,
  getProgramme,
  listBilans,
  creerBilan,
} from '../api/programmes';
import { ApiError } from '../api/client';

export default function RevuePage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [succes, setSucces] = useState(false);

  const [quoiAMarche, setQuoiAMarche] = useState('');
  const [quoiNaPasMarche, setQuoiNaPasMarche] = useState('');
  const [ajustement, setAjustement] = useState('');
  const [decision, setDecision] = useState<DecisionBilan>('consolider');

  async function charger() {
    const programmes = await listProgrammes();
    const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
    if (!actif) {
      setChargement(false);
      return;
    }
    setProgramme(actif);
    const b = await listBilans(actif.id_programme);
    setBilans(b);
    setChargement(false);
  }

  useEffect(() => {
    charger().catch(() => {
      setErreur('Impossible de charger tes bilans.');
      setChargement(false);
    });
  }, []);

  const bilanSemaineCourante = programme
    ? bilans.find((b) => b.semaine === programme.semaine_courante)
    : undefined;

  async function handleSubmit() {
    if (!programme) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await creerBilan(programme.id_programme, {
        semaine: programme.semaine_courante,
        quoi_a_marche: quoiAMarche || null,
        quoi_n_a_pas_marche: quoiNaPasMarche || null,
        ajustement_semaine_suivante: ajustement || null,
        decision,
      });
      // Le programme peut avoir avancé de semaine côté serveur (RG-12) —
      // on recharge tout plutôt que de deviner le nouvel état.
      const progFrais = await getProgramme(programme.id_programme);
      setProgramme(progFrais);
      const b = await listBilans(programme.id_programme);
      setBilans(b);
      setSucces(true);
      setQuoiAMarche('');
      setQuoiNaPasMarche('');
      setAjustement('');
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : 'Impossible d\'enregistrer le bilan.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Clôture hebdomadaire</p>
        <h1 style={styles.h1}>Revue</h1>
        <p style={styles.subtitle}>Un instant honnête avant de passer à la suite.</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && programme && (
          <>
            {bilanSemaineCourante ? (
              <article style={styles.card}>
                <p style={styles.eyebrowSmall}>Semaine {bilanSemaineCourante.semaine} déjà clôturée</p>
                <p style={styles.score}>{bilanSemaineCourante.score_snapshot}%</p>
                {bilanSemaineCourante.quoi_a_marche && (
                  <p style={styles.field}><strong>Ce qui a marché :</strong> {bilanSemaineCourante.quoi_a_marche}</p>
                )}
                {bilanSemaineCourante.quoi_n_a_pas_marche && (
                  <p style={styles.field}><strong>Ce qui n'a pas marché :</strong> {bilanSemaineCourante.quoi_n_a_pas_marche}</p>
                )}
                {bilanSemaineCourante.ajustement_semaine_suivante && (
                  <p style={styles.field}><strong>Ajustement :</strong> {bilanSemaineCourante.ajustement_semaine_suivante}</p>
                )}
                <p style={styles.decisionTag}>
                  Décision : {bilanSemaineCourante.decision === 'avancer' ? 'Avancer' : 'Consolider'}
                </p>
              </article>
            ) : (
              <article style={styles.card}>
                <p style={styles.eyebrowSmall}>Semaine {programme.semaine_courante} sur 4</p>
                <h3 style={styles.cardTitle}>Comment cette semaine s'est-elle passée ?</h3>

                <label style={styles.label}>
                  Ce qui a marché
                  <textarea style={styles.textarea} value={quoiAMarche} onChange={(e) => setQuoiAMarche(e.target.value)} rows={2} />
                </label>

                <label style={styles.label}>
                  Ce qui n'a pas marché
                  <textarea style={styles.textarea} value={quoiNaPasMarche} onChange={(e) => setQuoiNaPasMarche(e.target.value)} rows={2} />
                </label>

                <label style={styles.label}>
                  Un ajustement pour la semaine suivante
                  <textarea style={styles.textarea} value={ajustement} onChange={(e) => setAjustement(e.target.value)} rows={2} />
                </label>

                <div style={styles.decisionRow}>
                  <button
                    onClick={() => setDecision('consolider')}
                    style={{ ...styles.decisionBtn, ...(decision === 'consolider' ? styles.decisionBtnActive : {}) }}
                  >
                    Consolider
                    <small style={styles.decisionDesc}>Je reste sur cette semaine, je stabilise avant d'ajouter une couche.</small>
                  </button>
                  <button
                    onClick={() => setDecision('avancer')}
                    style={{ ...styles.decisionBtn, ...(decision === 'avancer' ? styles.decisionBtnActive : {}) }}
                  >
                    Avancer
                    <small style={styles.decisionDesc}>Je suis prêt pour la semaine suivante.</small>
                  </button>
                </div>

                <button onClick={handleSubmit} disabled={envoiEnCours} style={styles.submitBtn}>
                  {envoiEnCours ? 'Enregistrement…' : 'Clôturer la semaine'}
                </button>
              </article>
            )}

            {succes && <p style={{ color: 'var(--sprout)', fontSize: 13, marginTop: 8 }}>Bilan enregistré.</p>}

            {bilans.length > 0 && (
              <>
                <div style={styles.sectionHead}>
                  <p style={styles.eyebrow}>Historique</p>
                  <h3 style={styles.h3}>Tes semaines précédentes</h3>
                </div>
                <div style={styles.historyList}>
                  {bilans
                    .filter((b) => b.semaine !== programme.semaine_courante || bilanSemaineCourante)
                    .map((b) => (
                      <div key={b.id_bilan} style={styles.historyItem}>
                        <span>Semaine {b.semaine}</span>
                        <span style={styles.historyScore}>{b.score_snapshot}%</span>
                        <span style={styles.historyDecision}>{b.decision === 'avancer' ? 'Avancer' : 'Consolider'}</span>
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
  eyebrowSmall: { fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 6px' },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  cardTitle: { fontFamily: 'var(--serif)', fontSize: 19, margin: '0 0 18px' },
  score: { fontFamily: 'var(--serif)', fontSize: 32, color: 'var(--sprout)', margin: '0 0 12px' },
  field: { fontSize: 13, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.5 },
  decisionTag: { fontSize: 12, color: 'var(--text-muted)', marginTop: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 },
  textarea: {
    background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 10,
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
  },
  decisionRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '10px 0 18px' },
  decisionBtn: {
    display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', padding: 14,
    border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, color: 'var(--text)',
    cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
  },
  decisionBtnActive: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)' },
  decisionDesc: { color: 'var(--text-muted)', fontWeight: 400, fontSize: 11.5 },
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
  historyScore: { color: 'var(--sprout)' },
  historyDecision: { color: 'var(--text-muted)', fontSize: 11.5 },
};
