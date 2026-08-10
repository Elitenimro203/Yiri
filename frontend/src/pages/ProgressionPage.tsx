import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { STAGES, stadeActuel } from '../components/GrowthPlant';
import {
  Programme,
  PilierProgres,
  Pilier,
  PILIERS,
  PILIER_LABELS,
  listProgrammes,
  getPiliers,
  getGrilleSuivi,
} from '../api/programmes';

const ICONS: Record<Pilier, string> = { corps: '◉', esprit: '⌁', caractere: '◇', impact: '↗' };
const SEMAINES = [1, 2, 3, 4];

interface PointSemaine {
  semaine: number;
  valeur: number | null; // null = pilier pas encore déverrouillé cette semaine-là
}

function MiniChart({ points, actuelle }: { points: PointSemaine[]; actuelle: number }) {
  const w = 220;
  const h = 70;
  const padX = 12;
  const stepX = (w - padX * 2) / (SEMAINES.length - 1);

  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: p.valeur === null ? null : h - 10 - (p.valeur / 100) * (h - 20),
    semaine: p.semaine,
  }));

  const segments: string[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    if (coords[i].y === null || coords[i + 1].y === null) continue;
    segments.push(`M${coords[i].x},${coords[i].y} L${coords[i + 1].x},${coords[i + 1].y}`);
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={padX} y1={h - 10} x2={w - padX} y2={h - 10} stroke="var(--line)" strokeWidth={1} />
      {segments.map((d, i) => (
        <path key={i} d={d} stroke="var(--sprout)" strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}
      {coords.map((c, i) =>
        c.y === null ? null : (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={c.semaine === actuelle ? 4.5 : 3}
            fill={c.semaine === actuelle ? 'var(--bloom)' : 'var(--sprout)'}
          />
        )
      )}
    </svg>
  );
}

export default function ProgressionPage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [dataParPilier, setDataParPilier] = useState<Record<Pilier, PointSemaine[]>>({
    corps: [], esprit: [], caractere: [], impact: [],
  });
  const [lifetimeParSemaine, setLifetimeParSemaine] = useState<number[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listProgrammes()
      .then(async (programmes) => {
        const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
        if (!actif) return;
        setProgramme(actif);

        // Une requête par semaine (max 4) — volume négligeable, pas besoin
        // d'une route d'agrégation dédiée pour ça.
        const piliersParSemaine = await Promise.all(
          SEMAINES.map((s) => getPiliers(actif.id_programme, s).catch<PilierProgres[]>(() => []))
        );

        const resultat: Record<Pilier, PointSemaine[]> = { corps: [], esprit: [], caractere: [], impact: [] };
        PILIERS.forEach((p) => {
          resultat[p] = SEMAINES.map((s, i) => {
            // Une semaine pas encore atteinte n'a pas de "score" — même si l'API
            // renvoie hypothétiquement un pilier déverrouillé pour cette semaine
            // future (calcul simulé), on ne l'affiche jamais comme une vraie
            // donnée : ça créerait une fausse impression de chute/régression.
            if (s > actif.semaine_courante) return { semaine: s, valeur: null };
            const trouve = piliersParSemaine[i].find((x) => x.pilier === p);
            return { semaine: s, valeur: trouve ? trouve.pourcentage : null };
          });
        });
        setDataParPilier(resultat);

        // Cumul lifetime À LA FIN de chaque semaine (semaine 1 → total après S1,
        // semaine 2 → total après S1+S2, etc.) pour situer le stade de l'arbre
        // dans le temps plutôt que juste "maintenant".
        const grillesParSemaine = await Promise.all(
          SEMAINES.map((s) => getGrilleSuivi(actif.id_programme, s).catch(() => []))
        );
        let cumul = 0;
        const cumulParSemaine = grillesParSemaine.map((grille) => {
          cumul += grille.filter((e) => e.coche).length;
          return cumul;
        });
        setLifetimeParSemaine(cumulParSemaine);
      })
      .catch(() => setErreur('Impossible de charger ta progression.'))
      .finally(() => setChargement(false));
  }, []);

  const lifetimeActuel = lifetimeParSemaine[lifetimeParSemaine.length - 1] ?? 0;
  const { stage, index: stageIdx } = stadeActuel(lifetimeActuel);

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Le temps long</p>
        <h1 style={styles.h1}>Progression</h1>
        <p style={styles.subtitle}>Pas un instantané — une trajectoire, semaine après semaine.</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && programme && (
          <>
            <section style={styles.grid}>
              {PILIERS.map((p) => (
                <article key={p} style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.icon}>{ICONS[p]}</span>
                    <h3 style={styles.pilierName}>{PILIER_LABELS[p]}</h3>
                  </div>
                  <MiniChart points={dataParPilier[p]} actuelle={programme.semaine_courante} />
                  <div style={styles.legend}>
                    {SEMAINES.map((s) => (
                      <span key={s} style={{ opacity: s <= programme.semaine_courante ? 1 : 0.4 }}>
                        S{s}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            <div style={styles.sectionHead}>
              <p style={styles.eyebrow}>L'arbre dans le temps</p>
              <h3 style={styles.h3}>Ton stade de vie a évolué ainsi</h3>
            </div>

            <article style={styles.stepperCard}>
              <div style={styles.stepper}>
                {STAGES.map((s, i) => (
                  <div key={s.nom} style={styles.step}>
                    <div
                      style={{
                        ...styles.stepDot,
                        ...(i <= stageIdx ? styles.stepDotDone : {}),
                        ...(i === stageIdx ? styles.stepDotCurrent : {}),
                      }}
                    />
                    <small style={{ color: i <= stageIdx ? 'var(--text)' : 'var(--text-muted)' }}>{s.nom}</small>
                    {i < STAGES.length - 1 && (
                      <div style={{ ...styles.stepLine, ...(i < stageIdx ? styles.stepLineDone : {}) }} />
                    )}
                  </div>
                ))}
              </div>
              <p style={styles.stepperCaption}>
                {lifetimeActuel} cases cochées depuis le début · stade actuel : <strong style={{ color: 'var(--sprout)' }}>{stage.nom}</strong>
              </p>
            </article>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 10 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  icon: { color: 'var(--sprout)', fontSize: 15 },
  pilierName: { margin: 0, fontSize: 14, fontFamily: 'var(--serif)' },
  legend: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', padding: '0 12px' },
  sectionHead: { margin: '30px 2px 12px' },
  h3: { margin: 0, fontSize: 16 },
  stepperCard: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  stepper: { display: 'flex', alignItems: 'center' },
  step: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
  stepDot: { width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--line)', background: 'var(--bg)', marginBottom: 8, zIndex: 1 },
  stepDotDone: { borderColor: 'var(--sprout)', background: 'var(--sprout-dim)' },
  stepDotCurrent: { borderColor: 'var(--bloom)', background: 'var(--bloom)' },
  stepLine: { position: 'absolute', top: 5, left: '55%', width: '90%', height: 2, background: 'var(--line)' },
  stepLineDone: { background: 'var(--sprout-dim)' },
  stepperCaption: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, marginTop: 16 },
};
