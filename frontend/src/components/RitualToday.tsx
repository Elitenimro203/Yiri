import { Axe, EntreeSuivi, axeActifJourIndex } from '../api/programmes';

interface RitualTodayProps {
  axesDeverrouilles: Axe[];
  entrees: EntreeSuivi[];
  jourIndex: number;
  onToggle: (axeId: number) => void;
  enCoursId: number | null;
}

export default function RitualToday({ axesDeverrouilles, entrees, jourIndex, onToggle, enCoursId }: RitualTodayProps) {
  // RG-11 : le rituel du jour ne montre que les axes programmés aujourd'hui —
  // un axe "Portfolio" avec jours_actifs="1,6" n'apparaît pas un mardi.
  const axesDuJour = axesDeverrouilles.filter((a) => axeActifJourIndex(a, jourIndex));

  const estCoche = (axeId: number) =>
    entrees.some((e) => e.id_axe === axeId && e.jour === jourIndex && e.coche);

  const nbCoches = axesDuJour.filter((a) => estCoche(a.id_axe)).length;
  const pct = axesDuJour.length > 0 ? Math.round((nbCoches / axesDuJour.length) * 100) : 0;

  return (
    <article style={styles.card}>
      <div style={styles.top}>
        <div>
          <p style={styles.eyebrow}>Rituel du jour</p>
          <h2 style={styles.title}>Nourrir la journée.</h2>
          <p style={styles.desc}>
            {axesDuJour.length} axe{axesDuJour.length > 1 ? 's' : ''} programmé{axesDuJour.length > 1 ? 's' : ''} aujourd'hui.
          </p>
        </div>
        <div style={styles.ring}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="var(--sprout)"
              strokeWidth="5"
              strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
            <text x="28" y="32" textAnchor="middle" fontSize="12" fill="var(--text)">
              {pct}%
            </text>
          </svg>
        </div>
      </div>

      <div style={styles.list}>
        {axesDuJour.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rien de programmé aujourd'hui — jour de repos pour ce rituel.</p>
        )}
        {axesDuJour.map((axe) => {
          const coche = estCoche(axe.id_axe);
          return (
            <button
              key={axe.id_axe}
              onClick={() => onToggle(axe.id_axe)}
              disabled={enCoursId === axe.id_axe}
              style={{ ...styles.item, ...(coche ? styles.itemDone : {}) }}
            >
              <span style={{ ...styles.mark, ...(coche ? styles.markDone : {}) }}>{coche ? '✓' : '○'}</span>
              <span style={styles.itemLabel}>{axe.nom}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  title: { fontFamily: 'var(--serif)', fontSize: 19, margin: '6px 0' },
  desc: { color: 'var(--text-muted)', margin: 0, fontSize: 12.5 },
  ring: { flexShrink: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    borderRadius: 12,
    color: 'var(--text)',
    fontSize: 12.5,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  itemDone: { borderColor: 'var(--sprout-dim)' },
  mark: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid var(--line)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  markDone: { background: 'var(--sprout-dim)', borderColor: 'var(--sprout)', color: 'var(--sprout)' },
  itemLabel: { fontWeight: 500 },
};
