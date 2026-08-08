import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Programme,
  Axe,
  EntreeSuivi,
  PilierProgres,
  Pilier,
  PILIERS,
  PILIER_LABELS,
  listProgrammes,
  listAxes,
  getGrilleSuivi,
  getPiliers,
  toggleCase,
  axeActifJourIndex,
} from '../api/programmes';
import { ApiError } from '../api/client';

const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const ICONS: Record<Pilier, string> = { corps: '◉', esprit: '⌁', caractere: '◇', impact: '↗' };

export default function CulturePage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [axes, setAxes] = useState<Axe[]>([]);
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [piliers, setPiliers] = useState<PilierProgres[]>([]);
  const [pilierActif, setPilierActif] = useState<Pilier>('corps');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toggleEnCours, setToggleEnCours] = useState<string | null>(null); // `${axeId}-${jour}`

  const chargerTout = useCallback(async (prog: Programme) => {
    const semaine = prog.semaine_courante;
    const [axesData, entreesData, piliersData] = await Promise.all([
      listAxes(prog.id_programme),
      getGrilleSuivi(prog.id_programme, semaine),
      getPiliers(prog.id_programme, semaine),
    ]);
    setAxes(axesData);
    setEntreesSemaine(entreesData);
    setPiliers(piliersData);
  }, []);

  useEffect(() => {
    listProgrammes()
      .then(async (programmes) => {
        const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
        if (!actif) return;
        setProgramme(actif);
        await chargerTout(actif);
      })
      .catch(() => setErreur('Impossible de charger tes données.'))
      .finally(() => setChargement(false));
  }, [chargerTout]);

  async function handleToggle(axe: Axe, jour: number) {
    if (!programme || !axe.deverrouille) return;
    const cle = `${axe.id_axe}-${jour}`;
    setToggleEnCours(cle);
    try {
      await toggleCase(axe.id_axe, programme.semaine_courante, jour);
      await chargerTout(programme);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : 'Impossible d\'enregistrer.');
    } finally {
      setToggleEnCours(null);
    }
  }

  const estCoche = (axeId: number, jour: number) =>
    entreesSemaine.some((e) => e.id_axe === axeId && e.jour === jour && e.coche);

  const axesDuPilier = axes.filter((a) => a.pilier === pilierActif).sort((a, b) => a.ordre_affichage - b.ordre_affichage);

  return (
    <div style={styles.app}>
      <Sidebar />
      <main style={styles.main}>
        <p style={styles.eyebrow}>Les racines</p>
        <h1 style={styles.h1}>Ma culture</h1>
        <p style={styles.subtitle}>Le détail de ce que tu nourris, pilier par pilier.</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && programme && (
          <>
            <div style={styles.tabs}>
              {PILIERS.map((p) => {
                const info = piliers.find((x) => x.pilier === p);
                return (
                  <button
                    key={p}
                    onClick={() => setPilierActif(p)}
                    style={{ ...styles.tab, ...(pilierActif === p ? styles.tabActive : {}) }}
                  >
                    <span style={styles.tabIcon}>{ICONS[p]}</span>
                    <span>{PILIER_LABELS[p]}</span>
                    <span style={styles.tabPct}>{info ? `${info.pourcentage}%` : '—'}</span>
                  </button>
                );
              })}
            </div>

            <div style={styles.list}>
              {axesDuPilier.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>Aucun axe dans ce pilier.</p>
              )}
              {axesDuPilier.map((axe) => (
                <article key={axe.id_axe} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div>
                      <h3 style={styles.axeName}>{axe.nom}</h3>
                      {!axe.deverrouille && (
                        <small style={styles.locked}>Bourgeon fermé — se débloque en semaine {axe.phase_deverrouillage}</small>
                      )}
                    </div>
                  </div>
                  <div style={styles.week}>
                    {NOMS_JOURS.map((nom, i) => {
                      const actifCeJour = axeActifJourIndex(axe, i);
                      const coche = estCoche(axe.id_axe, i);
                      const disabled = !axe.deverrouille || !actifCeJour || toggleEnCours === `${axe.id_axe}-${i}`;
                      return (
                        <button
                          key={i}
                          disabled={disabled}
                          onClick={() => handleToggle(axe, i)}
                          style={{
                            ...styles.dayBtn,
                            ...(coche ? styles.dayBtnDone : {}),
                            ...(!actifCeJour ? styles.dayBtnInactive : {}),
                            opacity: !axe.deverrouille ? 0.35 : !actifCeJour ? 0.3 : 1,
                          }}
                          title={!actifCeJour ? 'Pas programmé ce jour' : nom}
                        >
                          <small>{nom}</small>
                          <span>{coche ? '✓' : '○'}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
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
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  tabs: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    padding: '14px 8px',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    borderRadius: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 12.5,
  },
  tabActive: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)', color: 'var(--text)' },
  tabIcon: { fontSize: 16, color: 'var(--sprout)' },
  tabPct: { fontSize: 11, color: 'var(--text-muted)' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 },
  cardHead: { marginBottom: 12 },
  axeName: { margin: 0, fontSize: 15, fontFamily: 'var(--serif)' },
  locked: { color: 'var(--locked)', fontSize: 11 },
  week: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
  dayBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 4px',
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    borderRadius: 9,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 12,
  },
  dayBtnDone: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)', color: 'var(--sprout)' },
  dayBtnInactive: { cursor: 'not-allowed' },
};
