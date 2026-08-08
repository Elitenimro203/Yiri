import { ModeDeverrouillage } from '../api/programmes';

interface ModeSwitchProps {
  mode: ModeDeverrouillage;
  onChange: (mode: ModeDeverrouillage) => void;
  enCours: boolean;
}

export default function ModeSwitch({ mode, onChange, enCours }: ModeSwitchProps) {
  return (
    <article style={styles.card}>
      <p style={styles.eyebrow}>Architecture du programme</p>
      <div style={styles.row}>
        <div>
          <h4 style={styles.title}>Déverrouillage des axes</h4>
          <p style={styles.desc}>Le programme peut révéler les dimensions progressivement ou tout de suite.</p>
        </div>
        <div style={styles.switchWrap}>
          <button
            disabled={enCours}
            onClick={() => onChange('progressif')}
            style={{ ...styles.switchBtn, ...(mode === 'progressif' ? styles.switchBtnActive : {}) }}
          >
            Progressif
          </button>
          <button
            disabled={enCours}
            onClick={() => onChange('complet')}
            style={{ ...styles.switchBtn, ...(mode === 'complet' ? styles.switchBtnActive : {}) }}
          >
            Complet
          </button>
        </div>
      </div>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 22 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 14 },
  desc: { fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' },
  switchWrap: { display: 'flex', border: '1px solid var(--line)', borderRadius: 10, padding: 3, background: 'var(--bg)' },
  switchBtn: { border: 'none', background: 'none', padding: '8px 12px', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer' },
  switchBtnActive: { background: 'var(--surface-2)', color: 'var(--sprout)' },
};
