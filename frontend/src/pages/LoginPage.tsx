import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function LoginPage() {
  const { connecter } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await connecter(email, motDePasse);
      navigate('/');
    } catch (err) {
      // Message générique volontaire — le backend renvoie déjà la même erreur
      // pour "email inconnu" et "mot de passe faux" (anti-énumération de comptes),
      // le frontend ne doit pas réintroduire cette distinction.
      if (err instanceof ApiError) {
        setErreur(err.detail);
      } else {
        setErreur('Connexion impossible — vérifie que le serveur est bien lancé.');
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Yiri</p>
        <h1 style={styles.title}>Bon retour</h1>
        <p style={styles.subtitle}>Connecte-toi pour reprendre ton suivi de la semaine.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoFocus
            />
          </label>

          <label style={styles.label}>
            Mot de passe
            <input
              type="password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              style={styles.input}
            />
          </label>

          {erreur && <p style={styles.erreur}>{erreur}</p>}

          <button type="submit" disabled={enCours} style={styles.bouton}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '32px 28px',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--sprout)',
    fontWeight: 600,
    margin: '0 0 8px',
  },
  title: {
    fontFamily: 'var(--serif)',
    fontSize: 26,
    margin: '0 0 6px',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: 13.5,
    margin: '0 0 26px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  input: {
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    borderRadius: 7,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 14,
  },
  erreur: {
    background: 'var(--error-dim)',
    color: 'var(--error)',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 7,
    margin: 0,
  },
  bouton: {
    background: 'var(--sprout)',
    color: '#161D14',
    border: 'none',
    borderRadius: 7,
    padding: '12px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
};
