import { libelleJourRelatif } from '../../lib/dates';
import type { Trace } from '../../lib/traces';

const NOM_TYPE: Record<Trace['type'], string> = {
  action: 'Action',
  observation: 'Observation',
  decision: 'Décision',
};

// « Ce qui s'est réellement passé » : un fil daté, sans jugement (ni coche,
// ni croix, ni compteur). Le symbole est décoratif ; le type est donné en
// texte aux lecteurs d'écran.
export default function FilTraces({ traces, aujourdhui }: { traces: Trace[]; aujourdhui: string }) {
  if (traces.length === 0) {
    return (
      <div className="y-section">
        <div className="y-fil-attente" aria-hidden="true" />
        <p className="y-caption y-muted">Ta trajectoire commencera à ta première trace.</p>
      </div>
    );
  }
  return (
    <ul className="y-fil" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {traces.map((t) => (
        <li key={t.cle} className="y-trace">
          <span className={`y-glyphe y-glyphe-${t.type}`} aria-hidden="true" />
          <span className="y-caption">{libelleJourRelatif(t.jour, aujourdhui)}</span>
          <span className={t.type === 'observation' ? 'y-quote' : 'y-body'}>
            <span className="y-sr">{NOM_TYPE[t.type]} : </span>
            {t.type === 'observation' ? `« ${t.texte} »` : t.texte}
          </span>
        </li>
      ))}
    </ul>
  );
}
