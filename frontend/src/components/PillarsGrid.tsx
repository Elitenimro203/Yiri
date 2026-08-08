import { PILIERS, PILIER_LABELS, PilierProgres, Pilier, Regularite } from '../api/programmes';

const ICONS: Record<string, string> = { corps: '◉', esprit: '⌁', caractere: '◇', impact: '↗' };
const DESCRIPTIONS: Record<string, string> = {
  corps: 'Énergie, force, présence.',
  esprit: 'Connaissance, lecture, clarté.',
  caractere: 'Discipline, maîtrise, parole.',
  impact: 'Travail, projets, contribution.',
};

interface PillarsGridProps {
  progres: PilierProgres[];
  regularites: Partial<Record<Pilier, Regularite>>;
}

export default function PillarsGrid({ progres, regularites }: PillarsGridProps) {
  return (
    <section style={styles.grid}>
      {PILIERS.map((pilier) => {
        const p = progres.find((x) => x.pilier === pilier);
        const reg = regularites[pilier];
        const verrouille = !p;
        return (
          <article key={pilier} style={styles.card}>
            <div style={styles.icon}>{ICONS[pilier]}</div>
            <h4 style={styles.name}>{PILIER_LABELS[pilier]}</h4>
            <p style={styles.desc}>{DESCRIPTIONS[pilier]}</p>
            {verrouille ? (
              <p style={styles.locked}>Verrouillé — pas encore d'axe actif</p>
            ) : (
              <div style={styles.mini}>
                <span style={styles.pct}>{reg?.pourcentage ?? 0}% de régularité</span>
                <div style={styles.bar}>
                  <div style={{ ...styles.barFill, width: `${reg?.pourcentage ?? 0}%` }} />
                </div>
                <small style={styles.weekPct}>{p!.pourcentage}% de la semaine complète</small>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, minHeight: 140 },
  icon: { fontSize: 19, marginBottom: 12, color: 'var(--sprout)' },
  name: { margin: '0 0 3px', fontSize: 14, fontFamily: 'var(--serif)' },
  desc: { margin: 0, color: 'var(--text-muted)', fontSize: 11 },
  locked: { color: 'var(--locked)', fontSize: 11, marginTop: 16 },
  mini: { marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  pct: { fontSize: 12, color: 'var(--text)' },
  bar: { height: 4, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: 'linear-gradient(90deg, var(--sprout-dim), var(--sprout))', borderRadius: 999 },
  weekPct: { color: 'var(--text-muted)', fontSize: 10 },
};
