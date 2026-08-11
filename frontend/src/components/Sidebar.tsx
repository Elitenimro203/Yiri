import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Les 5 vues sont maintenant réellement construites et branchées sur l'API.
const NAV_ITEMS = [
  { id: 'aujourdhui', label: "Aujourd'hui", icon: '◈', path: '/', dispo: true },
  { id: 'culture', label: 'Ma culture', icon: '⌁', path: '/culture', dispo: true },
  { id: 'progression', label: 'Progression', icon: '◒', path: '/progression', dispo: true },
  { id: 'revue', label: 'Revue', icon: '◷', path: '/revue', dispo: true },
  { id: 'rappels', label: 'Rappels', icon: '🔔', path: '/rappels', dispo: true },
];

export default function Sidebar() {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initiales = (utilisateur?.nom || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="app-sidebar" style={styles.aside}>
      <div className="sidebar-brand" style={styles.brand}>
        <div style={styles.seed}>↗</div>
        <div>
          <strong style={styles.brandName}>Yiri</strong>
          <small style={styles.brandTag}>cultiver · construire · devenir</small>
        </div>
      </div>

      <nav className="sidebar-nav" style={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className="sidebar-nav-btn"
            style={{
              ...styles.navBtn,
              ...(item.path === location.pathname ? styles.navBtnActive : {}),
              opacity: item.dispo ? 1 : 0.45,
              cursor: item.dispo ? 'pointer' : 'default',
            }}
            disabled={!item.dispo}
            onClick={() => item.path && navigate(item.path)}
            title={item.dispo ? undefined : 'Bientôt disponible'}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {!item.dispo && <span className="sidebar-soon" style={styles.soon}>bientôt</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer" style={styles.bottom}>
        <div style={styles.avatarRow}>
          <div style={styles.avatar}>{initiales}</div>
          <span style={styles.userName}>{utilisateur?.nom}</span>
        </div>
        <button onClick={deconnecter} style={styles.logout}>
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 'var(--sidebar-w)',
    flexShrink: 0,
    borderRight: '1px solid var(--line)',
    padding: '28px 16px',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
  },
  brand: { display: 'flex', gap: 10, alignItems: 'center', padding: '4px 6px 30px' },
  seed: {
    width: 30,
    height: 30,
    border: '1px solid var(--sprout-dim)',
    borderRadius: '11px 11px 11px 3px',
    transform: 'rotate(-12deg)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--sprout)',
    fontWeight: 800,
    flexShrink: 0,
  },
  brandName: { fontFamily: 'var(--serif)', fontSize: 15, letterSpacing: '-0.02em', display: 'block' },
  brandTag: { color: 'var(--text-muted)', fontSize: 10 },
  nav: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  navBtn: {
    border: 'none',
    background: 'none',
    padding: '11px 12px',
    borderRadius: 12,
    textAlign: 'left',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13.5,
    width: '100%',
  },
  navBtnActive: { background: 'var(--surface-2)', color: 'var(--text)' },
  soon: { marginLeft: 'auto', fontSize: 9, color: 'var(--locked)' },
  bottom: { borderTop: '1px solid var(--line)', paddingTop: 14 },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid var(--line)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--sprout)',
    fontWeight: 700,
    fontSize: 11,
    background: 'var(--surface)',
  },
  userName: { fontSize: 12.5, color: 'var(--text-muted)' },
  logout: {
    width: '100%',
    background: 'none',
    border: '1px solid var(--line)',
    color: 'var(--text-muted)',
    padding: '8px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
};
