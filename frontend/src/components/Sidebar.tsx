import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApparence } from '../design/apparence';
import Icone, { type NomIcone } from './yiri/Icone';
import FeuilleNoter from './yiri/FeuilleNoter';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';

// Design 2b — navigation Yiri. Le nom du fichier reste « Sidebar » pour ne
// pas toucher aux pages qui l'importent.
// - Ordinateur : barre latérale claire (4 sections, « Noter », Rappels,
//   déconnexion).
// - Mobile (≤ 720px) : barre flottante en verre à 4 onglets + bouton + rond.
//   Rappels et déconnexion passent dans les Réglages d'Aujourd'hui.
// La Saison n'est pas un onglet : c'est un contexte (pastille sur Aujourd'hui).
// Le thème choisi s'applique à la navigation sur toutes les pages, même
// celles qui n'ont pas encore migré.

const SECTIONS: { to: string; label: string; icone: NomIcone }[] = [
  { to: '/today', label: "Aujourd'hui", icone: 'aujourdhui' },
  { to: '/constructions', label: 'Constructions', icone: 'constructions' },
  { to: '/trajectory', label: 'Trajectoire', icone: 'trajectoire' },
  { to: '/reflections', label: 'Réflexions', icone: 'reflexions' },
];

export default function Sidebar() {
  const { utilisateur, deconnecter } = useAuth();
  const [apparence] = useApparence();
  const [noterOuvert, setNoterOuvert] = useState(false);

  return (
    <div className="yiri y-nav-racine" data-yiri-theme={apparence.theme}>
      <aside className="y-rail" aria-label="Navigation">
        <p className="y-rail-marque">Yiri</p>
        <button type="button" className="y-btn y-btn-principal y-rail-noter" onClick={() => setNoterOuvert(true)}>
          <Icone nom="plus" /> Noter
        </button>
        <nav className="y-rail-nav" aria-label="Navigation principale">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} className="y-rail-lien" end={s.to === '/today'}>
              <Icone nom={s.icone} />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="y-rail-bas">
          <NavLink to="/reminders" className="y-rail-lien">
            <Icone nom="rappels" />
            Rappels
          </NavLink>
          <p className="y-caption y-muted y-rail-nom">{utilisateur?.nom}</p>
          <button type="button" className="y-rail-lien y-rail-sortir" onClick={deconnecter}>
            <Icone nom="sortir" />
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="y-barre" aria-label="Navigation">
        <nav className="y-barre-verre" aria-label="Navigation principale">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} className="y-barre-onglet" end={s.to === '/today'}>
              <Icone nom={s.icone} />
              <span className="y-tab">{s.label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="y-fab" aria-label="Noter ce qui s'est passé" onClick={() => setNoterOuvert(true)}>
          <Icone nom="plus" />
        </button>
      </div>

      {noterOuvert && <FeuilleNoter onFermer={() => setNoterOuvert(false)} />}
    </div>
  );
}
