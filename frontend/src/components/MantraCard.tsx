const MANTRAS = [
  "Ne cherche pas à paraître discipliné. Organise ta vie de façon à le devenir.",
  "Tu n'as pas besoin d'une journée parfaite. Tu as besoin d'un jour de plus.",
  "Petites actions. Résultats composés.",
];

export default function MantraCard() {
  // Statique pour l'instant — un vrai système choisirait selon la semaine/le
  // contexte, mais pas la peine de sur-engineer ça avant que le reste tienne.
  const mantra = MANTRAS[0];

  return (
    <article style={styles.card}>
      <p style={styles.eyebrow}>Mantra de la semaine</p>
      <p style={styles.quote}>« {mantra} »</p>
      <small style={styles.attribution}>— Ton système, tes preuves, ton identité.</small>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  quote: { fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.45, letterSpacing: '-0.01em', margin: '10px 0 12px' },
  attribution: { color: 'var(--text-muted)' },
};
