import { PILIERS, PILIER_LABELS, Pilier, PilierProgres } from '../api/programmes';

const COULEURS: Record<Pilier, string> = {
  corps: '#7FB069',
  esprit: '#9DBE5E',
  caractere: '#C9A84A',
  impact: '#E8B04B',
};

interface LifeGraphProps {
  /** Une entrée par semaine vécue (1..semaine_courante), dans l'ordre */
  semaines: { semaine: number; piliers: PilierProgres[] }[];
}

const W = 600;
const H = 220;
const PAD_L = 34;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 30;

export default function LifeGraph({ semaines }: LifeGraphProps) {
  const nbSemaines = semaines.length;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xPour = (i: number) => PAD_L + (nbSemaines <= 1 ? plotW / 2 : (i / (nbSemaines - 1)) * plotW);
  const yPour = (pct: number) => PAD_T + plotH - (pct / 100) * plotH;

  const lignesGrille = [0, 25, 50, 75, 100];

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {lignesGrille.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yPour(v)} y2={yPour(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={yPour(v) + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">
              {v}
            </text>
          </g>
        ))}

        {semaines.map((_, i) => (
          <text key={i} x={xPour(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
            S{semaines[i].semaine}
          </text>
        ))}

        {PILIERS.map((pilier) => {
          const points = semaines
            .map((s, i) => {
              const info = s.piliers.find((p) => p.pilier === pilier);
              return info ? { x: xPour(i), y: yPour(info.pourcentage) } : null;
            })
            .filter((p): p is { x: number; y: number } => p !== null);

          if (points.length === 0) return null;

          const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

          return (
            <g key={pilier}>
              <path d={path} fill="none" stroke={COULEURS[pilier]} strokeWidth={2} strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={COULEURS[pilier]} />
              ))}
            </g>
          );
        })}
      </svg>

      <div style={styles.legend}>
        {PILIERS.map((pilier) => {
          const derniere = semaines[semaines.length - 1]?.piliers.find((p) => p.pilier === pilier);
          return (
            <div key={pilier} style={styles.legendItem}>
              <span style={{ ...styles.dot, background: COULEURS[pilier] }} />
              <span>{PILIER_LABELS[pilier]}</span>
              <strong style={styles.legendPct}>{derniere ? `${derniere.pourcentage}%` : '—'}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  legend: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  legendPct: { color: 'var(--text)', marginLeft: 2 },
};
