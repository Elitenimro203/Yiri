import { Link } from 'react-router-dom';
import type { Intensite } from '../../design/apparence';
import Icone from './Icone';

interface Props {
  date: Date;
  intensite: Intensite;
  saison: { nom: string } | null;
  reglagesOuverts: boolean;
  onReglages: () => void;
}

// Le jour en très grand (Fraunces 300) et la question centrale. En intensité
// Affirmée, l'en-tête se pose sur un bloc de la couleur d'accent.
export default function EnTeteJour({ date, intensite, saison, reglagesOuverts, onReglages }: Props) {
  const jourSemaine = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const mois = date.toLocaleDateString('fr-FR', { month: 'long' });

  return (
    <header className="y-entete" data-intensite={intensite}>
      <div className="y-entete-haut">
        {saison ? (
          <Link to="/constructions" className="y-pastille-saison" data-yiri-cible="saison">
            Saison · {saison.nom}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="y-icone-btn"
          aria-label="Réglages"
          aria-expanded={reglagesOuverts}
          onClick={onReglages}
        >
          <Icone nom="reglages" />
        </button>
      </div>
      <div className="y-entete-jour">
        <p className="y-numeral-day">{date.getDate()}</p>
        <p className="y-entete-mois">
          <strong>{jourSemaine}</strong>
          <br />
          {mois}
        </p>
      </div>
      <h1 className="y-question">Qu'est-ce qui mérite ton attention aujourd'hui&#8239;?</h1>
    </header>
  );
}
