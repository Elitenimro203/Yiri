import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { activerNotifications, ActivationResultat } from '../api/push';
import { Rappel, listRappels, creerRappel, modifierRappel, supprimerRappel } from '../api/notifications';
import { Axe, listProgrammes, listAxes } from '../api/programmes';

const JOURS = [
  { iso: 1, label: 'L' }, { iso: 2, label: 'M' }, { iso: 3, label: 'M' },
  { iso: 4, label: 'J' }, { iso: 5, label: 'V' }, { iso: 6, label: 'S' }, { iso: 7, label: 'D' },
];

const MESSAGES_ACTIVATION: Record<ActivationResultat, string> = {
  active: 'Notifications activées sur cet appareil.',
  refuse: "Permission refusée — active-la dans les réglages du navigateur si tu changes d'avis.",
  non_supporte: "Ton navigateur ne supporte pas les notifications push. Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil), puis réessaie depuis l'app installée.",
  erreur: "Erreur lors de l'activation — réessaie, ou vérifie que le serveur est bien configuré.",
};

export default function RappelsPage() {
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [axes, setAxes] = useState<Axe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [statutActivation, setStatutActivation] = useState<ActivationResultat | null>(null);
  const [activationEnCours, setActivationEnCours] = useState(false);

  const [libelle, setLibelle] = useState('');
  const [heure, setHeure] = useState('19:30');
  const [joursChoisis, setJoursChoisis] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [axeId, setAxeId] = useState<string>('');
  const [creationEnCours, setCreationEnCours] = useState(false);

  async function charger() {
    const [r, programmes] = await Promise.all([listRappels(), listProgrammes()]);
    setRappels(r);
    const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
    if (actif) setAxes(await listAxes(actif.id_programme));
    setChargement(false);
  }

  useEffect(() => {
    charger().catch(() => setChargement(false));
  }, []);

  async function handleActiver() {
    setActivationEnCours(true);
    const resultat = await activerNotifications();
    setStatutActivation(resultat);
    setActivationEnCours(false);
  }

  function toggleJour(iso: number) {
    setJoursChoisis((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  async function handleCreer() {
    if (!libelle.trim() || joursChoisis.size === 0) return;
    setCreationEnCours(true);
    try {
      await creerRappel({
        libelle: libelle.trim(),
        heure: `${heure}:00`,
        jours_actifs: [...joursChoisis].sort().join(','),
        id_axe: axeId ? parseInt(axeId, 10) : null,
      });
      setLibelle('');
      await charger();
    } finally {
      setCreationEnCours(false);
    }
  }

  async function handleToggleActif(r: Rappel) {
    await modifierRappel(r.id_notification, { actif: !r.actif });
    await charger();
  }

  async function handleSupprimer(id: number) {
    await supprimerRappel(id);
    await charger();
  }

  return (
    <div style={styles.app}>
      <Sidebar />
      <main style={styles.main}>
        <p style={styles.eyebrow}>Nourrir même quand tu n'y penses pas</p>
        <h1 style={styles.h1}>Rappels</h1>
        <p style={styles.subtitle}>Des notifications sur ton téléphone, aux heures que tu choisis.</p>

        <article style={styles.card}>
          <h3 style={styles.cardTitle}>Activation sur cet appareil</h3>
          <p style={styles.desc}>
            À faire une fois par appareil (le tien, celui de ton frère...). Sur iPhone, l'app doit d'abord
            être ajoutée à l'écran d'accueil.
          </p>
          <button onClick={handleActiver} disabled={activationEnCours} style={styles.primaryBtn}>
            {activationEnCours ? 'Activation…' : 'Activer les notifications'}
          </button>
          {statutActivation && (
            <p style={{ ...styles.statutMsg, color: statutActivation === 'active' ? 'var(--sprout)' : 'var(--text-muted)' }}>
              {MESSAGES_ACTIVATION[statutActivation]}
            </p>
          )}
        </article>

        <article style={styles.card}>
          <h3 style={styles.cardTitle}>Nouveau rappel</h3>
          <div style={styles.form}>
            <input
              style={styles.input}
              placeholder="Libellé (ex. Réveil 4h)"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
            />
            <div style={styles.row}>
              <input type="time" style={styles.input} value={heure} onChange={(e) => setHeure(e.target.value)} />
              <select style={styles.input} value={axeId} onChange={(e) => setAxeId(e.target.value)}>
                <option value="">Rappel global</option>
                {axes.map((a) => (
                  <option key={a.id_axe} value={a.id_axe}>{a.nom}</option>
                ))}
              </select>
            </div>
            <div style={styles.joursRow}>
              {JOURS.map((j) => (
                <button
                  key={j.iso}
                  onClick={() => toggleJour(j.iso)}
                  style={{ ...styles.jourBtn, ...(joursChoisis.has(j.iso) ? styles.jourBtnActive : {}) }}
                >
                  {j.label}
                </button>
              ))}
            </div>
            <button onClick={handleCreer} disabled={creationEnCours} style={styles.primaryBtn}>
              {creationEnCours ? 'Création…' : 'Créer le rappel'}
            </button>
          </div>
        </article>

        <div style={styles.sectionHead}>
          <h3 style={styles.h3}>Tes rappels</h3>
        </div>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {!chargement && rappels.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Aucun rappel pour l'instant.</p>}

        <div style={styles.list}>
          {rappels.map((r) => (
            <div key={r.id_notification} style={styles.rappelItem}>
              <div>
                <strong style={{ opacity: r.actif ? 1 : 0.5 }}>{r.libelle}</strong>
                <p style={styles.rappelMeta}>
                  {r.heure.slice(0, 5)} · jours {r.jours_actifs}
                </p>
              </div>
              <div style={styles.rappelActions}>
                <button onClick={() => handleToggleActif(r)} style={styles.smallBtn}>
                  {r.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => handleSupprimer(r.id_notification)} style={styles.smallBtnDanger}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 720, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 22, marginBottom: 16 },
  cardTitle: { margin: '0 0 6px', fontSize: 15, fontFamily: 'var(--serif)' },
  desc: { color: 'var(--text-muted)', fontSize: 12.5, margin: '0 0 14px' },
  primaryBtn: { background: 'var(--sprout)', color: '#161D14', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  statutMsg: { fontSize: 12.5, marginTop: 10 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontSize: 13, flex: 1 },
  row: { display: 'flex', gap: 10 },
  joursRow: { display: 'flex', gap: 6 },
  jourBtn: { width: 34, height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 },
  jourBtnActive: { background: 'var(--surface-2)', borderColor: 'var(--sprout-dim)', color: 'var(--sprout)' },
  sectionHead: { margin: '10px 2px 12px' },
  h3: { margin: 0, fontSize: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  rappelItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 10 },
  rappelMeta: { color: 'var(--text-muted)', fontSize: 11.5, margin: '2px 0 0' },
  rappelActions: { display: 'flex', gap: 6 },
  smallBtn: { background: 'none', border: '1px solid var(--line)', color: 'var(--text-muted)', borderRadius: 7, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer' },
  smallBtnDanger: { background: 'none', border: '1px solid var(--line)', color: 'var(--error)', borderRadius: 7, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer' },
};
