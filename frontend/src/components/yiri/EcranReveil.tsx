import { useApparence } from '../../design/apparence';
import '../../design/yiri-tokens.css';
import '../../design/yiri-ui.css';
import { messageAttente, useDureeAttente } from '../../lib/attente';
import ArbreReveil from './ArbreReveil';

// Écran d'attente quand le serveur se réveille (jusqu'à une minute sur
// l'offre gratuite). Un arbre qui pousse — yiri, l'arbre — aux couleurs du
// thème : l'attente ressemble à Yiri au lieu de ressembler à une panne.

export default function EcranReveil() {
  const [apparence] = useApparence();
  const secondes = useDureeAttente(true);
  const { principal, loi } = messageAttente(secondes);

  return (
    <div className="yiri y-reveil" data-yiri-theme={apparence.theme} role="status" aria-live="polite" aria-busy="true">
      <div className="y-reveil-corps">
        <ArbreReveil />
        <p className="y-accueil-marque y-reveil-marque">Yiri</p>
        <p className="y-label y-muted">{principal}</p>
        <p className="y-quote y-reveil-loi" key={loi ?? 'vide'}>{loi ?? ' '}</p>
      </div>
    </div>
  );
}
