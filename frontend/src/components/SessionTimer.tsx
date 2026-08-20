import { useEffect, useState } from 'react';
import { Axe } from '../api/programmes';
import { SessionTravail, TypeSession, demarrerSession, terminerSession } from '../api/sessions';
import { ApiError } from '../api/client';

function formatChrono(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface SessionTimerProps {
  axe: Axe;
  sessionActive: SessionTravail | null;
  onChange: (session: SessionTravail | null) => void;
  onError: (msg: string) => void;
}

export default function SessionTimer({ axe, sessionActive, onChange, onError }: SessionTimerProps) {
  const [maintenant, setMaintenant] = useState(Date.now());
  const [typeChoisi, setTypeChoisi] = useState<TypeSession>('libre');
  const [dureeFocus, setDureeFocus] = useState(25);
  const [dureePause, setDureePause] = useState(5);
  const [enCours, setEnCours] = useState(false);

  const estCetAxe = sessionActive?.id_axe === axe.id_axe;
  const unAutreAxeActif = sessionActive !== null && !estCetAxe;

  // Tick chaque seconde uniquement quand CE composant affiche un chrono en cours —
  // pas de timer qui tourne pour rien sur les axes inactifs.
  useEffect(() => {
    if (!estCetAxe) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [estCetAxe]);

  async function handleDemarrer() {
    setEnCours(true);
    try {
      const session = await demarrerSession(
        axe.id_axe,
        typeChoisi,
        typeChoisi === 'pomodoro' ? dureeFocus : undefined,
        typeChoisi === 'pomodoro' ? dureePause : undefined
      );
      onChange(session);
    } catch (err) {
      onError(err instanceof ApiError ? err.detail : "Impossible de démarrer la session.");
    } finally {
      setEnCours(false);
    }
  }

  async function handleTerminer() {
    if (!sessionActive) return;
    setEnCours(true);
    try {
      await terminerSession(sessionActive.id_session);
      onChange(null);
    } catch (err) {
      onError(err instanceof ApiError ? err.detail : "Impossible de terminer la session.");
    } finally {
      setEnCours(false);
    }
  }

  if (!axe.deverrouille) {
    return null; // pas de chrono sur un axe verrouillé — cohérent avec le reste
  }

  if (estCetAxe && sessionActive) {
    const debut = new Date(sessionActive.date_debut).getTime();
    const ecouleSecondes = Math.max(0, Math.floor((maintenant - debut) / 1000));
    return (
      <div style={styles.wrap}>
        <div style={styles.chronoRow}>
          <span style={styles.dot} />
          <strong style={styles.chrono}>{formatChrono(ecouleSecondes)}</strong>
          {sessionActive.type === 'pomodoro' && (
            <span style={styles.badge}>Pomodoro {sessionActive.duree_focus_minutes}/{sessionActive.duree_pause_minutes}</span>
          )}
        </div>
        <button onClick={handleTerminer} disabled={enCours} style={styles.stopBtn}>
          {enCours ? '…' : 'Terminer'}
        </button>
      </div>
    );
  }

  if (unAutreAxeActif) {
    return <p style={styles.disabledNote}>Session active sur un autre axe</p>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.typeRow}>
        <button
          onClick={() => setTypeChoisi('libre')}
          style={{ ...styles.typeBtn, ...(typeChoisi === 'libre' ? styles.typeBtnActive : {}) }}
        >
          Libre
        </button>
        <button
          onClick={() => setTypeChoisi('pomodoro')}
          style={{ ...styles.typeBtn, ...(typeChoisi === 'pomodoro' ? styles.typeBtnActive : {}) }}
        >
          Pomodoro
        </button>
        {typeChoisi === 'pomodoro' && (
          <>
            <input
              type="number"
              min={1}
              max={120}
              value={dureeFocus}
              onChange={(e) => setDureeFocus(Number(e.target.value))}
              style={styles.numInput}
              title="Minutes de focus"
            />
            <span style={styles.slash}>/</span>
            <input
              type="number"
              min={1}
              max={60}
              value={dureePause}
              onChange={(e) => setDureePause(Number(e.target.value))}
              style={styles.numInput}
              title="Minutes de pause"
            />
          </>
        )}
      </div>
      <button onClick={handleDemarrer} disabled={enCours} style={styles.startBtn}>
        {enCours ? '…' : '▷ Démarrer'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  chronoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--bloom)', boxShadow: '0 0 6px var(--bloom)' },
  chrono: { fontFamily: 'var(--serif)', fontSize: 16, fontVariantNumeric: 'tabular-nums' },
  badge: { fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' },
  stopBtn: { background: 'var(--error-dim)', color: 'var(--error)', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  disabledNote: { fontSize: 11.5, color: 'var(--locked)', margin: '10px 0 0' },
  typeRow: { display: 'flex', alignItems: 'center', gap: 6 },
  typeBtn: { background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text-muted)', borderRadius: 7, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' },
  typeBtnActive: { borderColor: 'var(--sprout-dim)', color: 'var(--sprout)', background: 'var(--surface-2)' },
  numInput: { width: 40, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 11.5, padding: '4px 4px', textAlign: 'center' },
  slash: { color: 'var(--text-muted)', fontSize: 11 },
  startBtn: { background: 'var(--sprout)', color: '#161D14', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
