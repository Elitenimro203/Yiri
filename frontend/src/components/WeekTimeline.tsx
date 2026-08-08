import { Axe, EntreeSuivi, axeActifJourIndex } from '../api/programmes';

const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface WeekTimelineProps {
  axesDeverrouilles: Axe[];
  entrees: EntreeSuivi[];
  jourIndexAujourdhui: number;
}

/** Lundi de la semaine calendaire courante, pour afficher les vraies dates */
function lundiDeCetteSemaine(): Date {
  const d = new Date();
  const jour = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - jour);
  return d;
}

export default function WeekTimeline({ axesDeverrouilles, entrees, jourIndexAujourdhui }: WeekTimelineProps) {
  const lundi = lundiDeCetteSemaine();

  return (
    <section style={styles.card}>
      <div style={styles.days}>
        {NOMS_JOURS.map((nom, i) => {
          const date = new Date(lundi);
          date.setDate(lundi.getDate() + i);
          const estFutur = i > jourIndexAujourdhui;
          const estAujourdhui = i === jourIndexAujourdhui;

          const axesDeCeJour = axesDeverrouilles.filter((a) => axeActifJourIndex(a, i));
          const cochesCeJour = axesDeCeJour.filter((a) =>
            entrees.some((e) => e.id_axe === a.id_axe && e.jour === i && e.coche)
          ).length;
          const complet = axesDeCeJour.length > 0 && cochesCeJour === axesDeCeJour.length;
          const partiel = cochesCeJour > 0 && !complet;

          return (
            <div
              key={i}
              style={{
                ...styles.day,
                ...(estAujourdhui ? styles.dayActive : {}),
                ...(estFutur ? styles.dayFuture : {}),
              }}
            >
              <small style={styles.dayName}>{nom}</small>
              <b style={styles.dayNum}>{String(date.getDate()).padStart(2, '0')}</b>
              <span
                style={{
                  ...styles.dot,
                  background: complet ? 'var(--sprout)' : partiel ? 'var(--bloom)' : 'var(--line)',
                  boxShadow: complet ? '0 0 10px rgba(127,176,105,0.5)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 18 },
  days: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 },
  day: {
    padding: '11px 6px',
    border: '1px solid var(--line)',
    borderRadius: 12,
    textAlign: 'center',
    background: 'var(--bg)',
  },
  dayActive: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)' },
  dayFuture: { opacity: 0.45 },
  dayName: { display: 'block', color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase' },
  dayNum: { display: 'block', margin: '6px 0', fontSize: 12.5 },
  dot: { display: 'block', margin: '0 auto', width: 6, height: 6, borderRadius: '50%' },
};
