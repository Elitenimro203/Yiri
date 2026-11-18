import { Link } from 'react-router-dom';
import { THEMES, type Apparence } from '../../design/apparence';
import { useAuth } from '../../context/AuthContext';
import Icone from './Icone';

interface Props {
  apparence: Apparence;
  onChange: (changement: Partial<Apparence>) => void;
}

// Choix du thème (fond × accent) et de l'intensité. Préférence de ce
// navigateur uniquement, sans effet sur les données.
export default function ReglagesApparence({ apparence, onChange }: Props) {
  const { deconnecter } = useAuth();
  return (
    <section className="y-reglages" aria-label="Réglages">
      <div className="y-section">
        <p className="y-overline y-muted">Thème</p>
        <div className="y-pastilles">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="y-pastille-theme"
              aria-pressed={apparence.theme === t.id}
              onClick={() => onChange({ theme: t.id })}
            >
              <span className="y-pastille-couleurs" aria-hidden="true">
                <span style={{ background: t.bg }} />
                <span style={{ background: t.accent }} />
              </span>
              {t.nom}
            </button>
          ))}
        </div>
      </div>
      <div className="y-section">
        <p className="y-overline y-muted">Intensité</p>
        <div className="y-segment">
          <button type="button" aria-pressed={apparence.intensite === 'calme'} onClick={() => onChange({ intensite: 'calme' })}>
            Calme
          </button>
          <button type="button" aria-pressed={apparence.intensite === 'affirmee'} onClick={() => onChange({ intensite: 'affirmee' })}>
            Affirmée
          </button>
        </div>
      </div>
      <div className="y-actions-ligne">
        <Link to="/reminders" className="y-btn y-btn-secondaire"><Icone nom="rappels" /> Rappels</Link>
        <button type="button" className="y-btn y-btn-texte" onClick={deconnecter}><Icone nom="sortir" /> Se déconnecter</button>
      </div>
    </section>
  );
}
