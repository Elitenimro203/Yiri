import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Construction } from '../../api/constructions';
import type { Engagement } from '../../api/engagements';
import { aujourdhuiLocal, libelleJourRelatif } from '../../lib/dates';
import Icone from './Icone';

const FILS = ['var(--y-thread-2)', 'var(--y-thread-1)', 'var(--y-thread-3)'];

interface Props {
  construction: Construction;
  index: number;
  engagements: Engagement[];
  derniereTrace: string | null;
  aujourdhui: string;
  ouverte: boolean;
  onBasculer: () => void;
  onEnregistrer: (saisie: { contenu: string; date: string; idEngagement: number | null }) => Promise<void>;
  envoiEnCours: boolean;
}

// Une Construction : ce que la personne choisit de faire évoluer. Jamais de
// pourcentage, de compteur ni de jauge — seulement ce à quoi elle s'est
// engagée et la date de sa dernière trace, comme un fait.
export default function CarteConstruction({
  construction: c, index, engagements, derniereTrace, aujourdhui, ouverte, onBasculer, onEnregistrer, envoiEnCours,
}: Props) {
  const [contenu, setContenu] = useState('');
  const [date, setDate] = useState(aujourdhui);
  const [idEngagement, setIdEngagement] = useState<number | ''>('');
  const idFormulaire = `noter-${c.id_construction}`;

  const sousTitre = engagements[0]?.description ?? c.intention ?? null;

  async function enregistrer() {
    await onEnregistrer({ contenu: contenu.trim(), date, idEngagement: idEngagement || null });
    setContenu('');
    setIdEngagement('');
    setDate(aujourdhuiLocal());
  }

  return (
    <article className="y-carte">
      <div className="y-carte-ligne">
        <div className="y-carte-fil" style={{ background: FILS[index % FILS.length] }} aria-hidden="true" />
        <div className="y-carte-corps">
          <Link to="/constructions" className="y-carte-nom y-title-card">{c.nom}</Link>
          {sousTitre && <p className="y-label">{sousTitre}</p>}
          <p className="y-caption">
            {derniereTrace ? `Dernière trace : ${libelleJourRelatif(derniereTrace, aujourdhui).toLowerCase()}` : 'Pas encore de trace'}
          </p>
        </div>
        <button
          type="button"
          className="y-carte-ajout"
          aria-label={ouverte ? `Fermer la note pour ${c.nom}` : `Noter ce qui s'est passé pour ${c.nom}`}
          aria-expanded={ouverte}
          aria-controls={idFormulaire}
          onClick={onBasculer}
        >
          <Icone nom={ouverte ? 'fermer' : 'plus'} />
        </button>
      </div>

      {ouverte && (
        <div className="y-form" id={idFormulaire}>
          <label className="y-section">
            <span className="y-overline y-muted">Ce qui s'est passé</span>
            <input
              className="y-champ"
              type="text"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="En quelques mots"
              autoFocus
            />
          </label>
          <div className="y-form-ligne">
            <label>
              <span className="y-sr">Date</span>
              <input className="y-champ y-champ-petit" type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} />
            </label>
            {engagements.length > 0 && (
              <label>
                <span className="y-sr">Engagement lié</span>
                <select
                  className="y-champ y-champ-petit"
                  value={idEngagement}
                  onChange={(e) => setIdEngagement(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Lié à un engagement ? (facultatif)</option>
                  {engagements.map((e) => (
                    <option key={e.id_engagement} value={e.id_engagement}>{e.description}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="y-form-ligne">
            <button type="button" className="y-btn y-btn-principal" onClick={enregistrer} disabled={envoiEnCours}>
              Enregistrer
            </button>
            <button type="button" className="y-btn y-btn-texte" onClick={onBasculer}>Annuler</button>
          </div>
        </div>
      )}
    </article>
  );
}
