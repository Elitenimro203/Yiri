import GrowthPlant, { stadeActuel } from './GrowthPlant';

interface GrowthCardProps {
  lifetimeCoches: number;
  cocheesSemaine: number;
  possiblesSemaine: number;
  semaineCourante: number;
  regularitePourcentage: number;
}

export default function GrowthCard({ lifetimeCoches, cocheesSemaine, possiblesSemaine, semaineCourante, regularitePourcentage }: GrowthCardProps) {
  const pctSemaineComplete = possiblesSemaine > 0 ? Math.round((cocheesSemaine / possiblesSemaine) * 100) : 0;
  const { stage, suivant } = stadeActuel(lifetimeCoches);

  return (
    <article style={styles.card}>
      <div style={styles.head}>
        <div>
          <p style={styles.eyebrow}>Ta culture · semaine {semaineCourante}</p>
          <h2 style={styles.title}>Ce que tu nourris grandit.</h2>
          <p style={styles.desc}>La discipline n'est pas une liste à cocher. C'est l'environnement que tu crées.</p>
        </div>
        <span style={styles.badge}>S{semaineCourante} / 4</span>
      </div>

      <div style={styles.plantZone}>
        <GrowthPlant lifetimeCoches={lifetimeCoches} cocheesSemaine={cocheesSemaine} possiblesSemaine={possiblesSemaine} />
      </div>

      <div style={styles.foot}>
        <div>
          <strong style={styles.score}>{regularitePourcentage}%</strong>
          <span style={styles.scoreLabel}> de régularité (jours déjà vécus)</span>
          <br />
          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {pctSemaineComplete}% de la semaine complète une fois S{semaineCourante} terminée
          </small>
        </div>
        <div style={styles.stageInfo}>
          <div style={styles.stageBar}>
            <span style={{ color: 'var(--sprout)', fontWeight: 600 }}>{stage.nom}</span>
          </div>
          <small style={{ color: 'var(--text-muted)' }}>
            {suivant ? `${lifetimeCoches}/${suivant.seuil} vers "${suivant.nom}"` : 'stade maximal atteint'}
          </small>
        </div>
      </div>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    padding: 26,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  title: { fontFamily: 'var(--serif)', fontSize: 21, margin: '6px 0' },
  desc: { color: 'var(--text-muted)', margin: 0, fontSize: 13, maxWidth: 420 },
  badge: {
    fontSize: 11,
    color: 'var(--text-muted)',
    border: '1px solid var(--line)',
    padding: '6px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  plantZone: { display: 'flex', justifyContent: 'center', marginTop: 8 },
  foot: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  score: { fontSize: 27, letterSpacing: '-0.03em', fontFamily: 'var(--serif)' },
  scoreLabel: { color: 'var(--text-muted)', fontSize: 12 },
  stageInfo: { textAlign: 'right' },
  stageBar: { fontSize: 13 },
};
