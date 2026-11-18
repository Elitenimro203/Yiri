import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { register } from '../api/auth';
import { useApparence } from '../design/apparence';
import { validerInscription } from '../lib/validationInscription';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';

// Premier écran de Yiri : connexion ou création de compte. La phrase
// d'accueil reprend l'annexe de la vision : Yiri ne dit pas comment vivre.

type Mode = 'connexion' | 'inscription';

const MESSAGE_RESEAU = "Le serveur ne répond pas. S'il était en veille, il se réveille : réessaie dans une minute.";

export default function LoginPage() {
  const { connecter } = useAuth();
  const navigate = useNavigate();
  const [apparence] = useApparence();

  const [mode, setMode] = useState<Mode>('connexion');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function changerMode(m: Mode) {
    setMode(m);
    setErreur(null);
    setMotDePasse('');
    setConfirmation('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (mode === 'inscription') {
      const probleme = validerInscription({ nom, email, motDePasse, confirmation });
      if (probleme) {
        setErreur(probleme);
        return;
      }
    }

    setEnCours(true);
    try {
      if (mode === 'inscription') {
        await register(email.trim(), motDePasse, nom.trim());
      }
      await connecter(email.trim(), motDePasse);
      navigate('/');
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setErreur(MESSAGE_RESEAU);
      } else if (mode === 'inscription' && err.status === 422) {
        setErreur('Vérifie ton email et ton mot de passe (8 caractères au moins).');
      } else {
        // Connexion : message générique volontaire — le backend renvoie déjà la
        // même erreur pour « email inconnu » et « mot de passe faux »
        // (anti-énumération de comptes). Inscription : « Cet email est déjà utilisé ».
        setErreur(err.detail);
      }
    } finally {
      setEnCours(false);
    }
  }

  const inscription = mode === 'inscription';

  return (
    <main className="yiri y-auth" data-yiri-theme={apparence.theme}>
      <div className="y-auth-colonne">
        <p className="y-rail-marque" style={{ padding: 0 }}>Yiri</p>

        <div className="y-auth-intro">
          <h1 className="y-question">
            {inscription ? <>Yiri n'est pas là pour te dire <em>comment vivre</em>.</> : 'Content de te revoir.'}
          </h1>
          <p className="y-body y-muted">
            {inscription
              ? "Il t'aide à choisir ce qui mérite ton attention, à voir ce qui s'est réellement passé, à comprendre ce que cela t'apprend, et à décider de la suite."
              : 'Connecte-toi pour retrouver ce qui mérite ton attention.'}
          </p>
        </div>

        <form className="y-auth-form" onSubmit={handleSubmit} noValidate>
          {inscription && (
            <label className="y-section">
              <span className="y-label y-muted">Ton prénom</span>
              <input className="y-champ" type="text" autoComplete="given-name" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
            </label>
          )}
          <label className="y-section">
            <span className="y-label y-muted">Email</span>
            <input className="y-champ" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!inscription} />
          </label>
          <label className="y-section">
            <span className="y-label y-muted">Mot de passe</span>
            <input
              className="y-champ"
              type="password"
              autoComplete={inscription ? 'new-password' : 'current-password'}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              aria-describedby={inscription ? 'aide-mdp' : undefined}
            />
          </label>
          {inscription && <p id="aide-mdp" className="y-caption y-muted" style={{ marginTop: -8 }}>8 caractères au moins.</p>}
          {inscription && (
            <label className="y-section">
              <span className="y-label y-muted">Confirme le mot de passe</span>
              <input className="y-champ" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
          )}

          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="y-btn y-btn-principal" disabled={enCours}>
            {enCours ? (inscription ? 'Création…' : 'Connexion…') : inscription ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        <p className="y-label y-muted y-auth-bascule">
          {inscription ? 'Tu as déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <button type="button" className="y-lien y-auth-lien" onClick={() => changerMode(inscription ? 'connexion' : 'inscription')}>
            {inscription ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>

        {inscription && (
          <p className="y-caption y-muted">Pas de score. Pas de série à tenir. Tu peux faire une pause quand tu veux.</p>
        )}
      </div>
    </main>
  );
}
