import { useEffect, useRef } from 'react';

// Premier lancement, compte vide : dire en deux phrases ce que Yiri est (et
// n'est pas), puis laisser commencer. Une seule fois par appareil.

export default function Accueil({ onCommencer }: { onCommencer: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => { bouton.current?.focus(); }, []);

  return (
    <section className="y-accueil" role="dialog" aria-modal="true" aria-labelledby="accueil-titre">
      <div className="y-accueil-corps">
        <p className="y-accueil-marque">Yiri</p>
        <div className="y-accueil-centre">
          <h1 id="accueil-titre" className="y-accueil-titre">
            Yiri n'est pas là pour te dire <em>comment vivre</em>.
          </h1>
          <p className="y-body-lg y-muted">
            Il t'aide à choisir ce qui mérite ton attention, à voir ce qui s'est réellement passé,
            à comprendre ce que cela t'apprend, et à décider de la suite.
          </p>
          <div className="y-accueil-fil" aria-hidden="true"><span /></div>
        </div>
        <div className="y-accueil-bas">
          <button ref={bouton} type="button" className="y-btn y-btn-principal y-accueil-btn" onClick={onCommencer}>
            Commencer
          </button>
          <p className="y-caption y-muted">Pas de score. Pas de série à tenir.<br />Tu peux faire une pause quand tu veux.</p>
        </div>
      </div>
    </section>
  );
}
