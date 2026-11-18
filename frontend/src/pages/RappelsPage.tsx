import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { activerNotifications, ActivationResultat } from '../api/push';
import { Rappel, listRappels, creerRappel, modifierRappel, supprimerRappel } from '../api/notifications';
import { Construction, listerConstructions } from '../api/constructions';
import { grouperConstructions } from '../lib/constructions';
import { JOURS, libelleJours } from '../lib/rappels';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';


const MESSAGES_ACTIVATION: Record<ActivationResultat, string> = {
  active: 'Notifications activées sur cet appareil.',
  refuse: "Permission refusée — active-la dans les réglages du navigateur si tu changes d'avis.",
  non_supporte: "Ton navigateur ne supporte pas les notifications push. Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil), puis réessaie depuis l'app installée.",
  erreur: "Erreur lors de l'activation — réessaie, ou vérifie que le serveur est bien configuré.",
};

export default function RappelsPage() {
  const [apparence] = useApparence();
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [statutActivation, setStatutActivation] = useState<ActivationResultat | null>(null);
  const [activationEnCours, setActivationEnCours] = useState(false);

  const [libelle, setLibelle] = useState('');
  const [heure, setHeure] = useState('19:30');
  const [joursChoisis, setJoursChoisis] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [constructionId, setConstructionId] = useState<string>('');
  const [creationEnCours, setCreationEnCours] = useState(false);

  async function charger() {
    const [r, liste] = await Promise.all([listRappels(), listerConstructions().catch(() => [] as Construction[])]);
    setRappels(r);
    setConstructions(liste);
    setChargement(false);
  }

  useEffect(() => {
    charger().catch(() => { setErreur('Impossible de charger tes rappels.'); setChargement(false); });
  }, []);

  async function handleActiver() {
    setActivationEnCours(true);
    const resultat = await activerNotifications();
    setStatutActivation(resultat);
    setActivationEnCours(false);
  }

  function toggleJour(iso: number) {
    setJoursChoisis((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  async function handleCreer() {
    if (!libelle.trim() || joursChoisis.size === 0) return;
    setCreationEnCours(true);
    setErreur(null);
    try {
      await creerRappel({
        libelle: libelle.trim(),
        heure: `${heure}:00`,
        jours_actifs: [...joursChoisis].sort((a, b) => a - b).join(','),
        id_axe: constructionId ? parseInt(constructionId, 10) : null,
      });
      setLibelle('');
      await charger();
    } catch {
      setErreur('Impossible de créer le rappel.');
    } finally {
      setCreationEnCours(false);
    }
  }

  async function handleToggleActif(r: Rappel) {
    await modifierRappel(r.id_notification, { actif: !r.actif }).catch(() => setErreur('Impossible de modifier le rappel.'));
    await charger();
  }

  async function handleSupprimer(r: Rappel) {
    if (!window.confirm(`Supprimer le rappel « ${r.libelle} » ?`)) return;
    await supprimerRappel(r.id_notification).catch(() => setErreur('Impossible de supprimer le rappel.'));
    await charger();
  }

  // Seules les Constructions encore vivantes sont proposées ; un rappel déjà
  // lié à une Construction close garde son nom à l'affichage.
  const { saison, horsSaison } = grouperConstructions(constructions, null);
  const choix = [...saison, ...horsSaison];
  const nomConstruction = (id: number | null) => constructions.find((c) => c.id_construction === id)?.nom;
  const formulaireValide = libelle.trim().length > 0 && joursChoisis.size > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="page-main yiri" data-yiri-theme={apparence.theme} style={{ flex: 1, width: '100%', padding: 0 }}>
        <div className="y-page">
          <header className="y-entete-page">
            <p className="y-overline">Rappels</p>
            <h1 className="y-question">Quand veux-tu que Yiri te fasse signe&#8239;?</h1>
            <p className="y-body y-muted">Une notification sur ton téléphone, aux heures que tu choisis. Un signe, jamais une injonction.</p>
          </header>

          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}

          <section className="y-section" aria-labelledby="rap-tes">
            <h2 id="rap-tes" className="y-overline y-muted">Tes rappels</h2>
            {chargement && <p className="y-muted">Chargement…</p>}
            {!chargement && rappels.length === 0 && <p className="y-label y-muted">Aucun rappel pour l'instant.</p>}
            <ul className="y-traj-fil" role="list">
              {rappels.map((r) => (
                <li key={r.id_notification} className={`y-rappel${r.actif ? '' : ' y-rappel-eteint'}`}>
                  <span className="y-rappel-heure">{r.heure.slice(0, 5)}</span>
                  <span className="y-rappel-corps">
                    <span className="y-body">{r.libelle}</span>
                    <span className="y-caption y-muted">
                      {libelleJours(r.jours_actifs)}
                      {r.id_axe != null && nomConstruction(r.id_axe) && <> · {nomConstruction(r.id_axe)}</>}
                      {!r.actif && <> · en pause</>}
                    </span>
                  </span>
                  <span className="y-actions-ligne">
                    <button type="button" className="y-btn y-btn-texte" onClick={() => handleToggleActif(r)}>
                      {r.actif ? 'Mettre en pause' : 'Réactiver'}
                    </button>
                    <button type="button" className="y-btn y-btn-texte y-erreur" onClick={() => handleSupprimer(r)} aria-label={`Supprimer ${r.libelle}`}>
                      Supprimer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="y-section y-carte-note" aria-labelledby="rap-nouveau">
            <h2 id="rap-nouveau" className="y-title-card">Nouveau rappel</h2>
            <label className="y-label y-refl-champ">
              Libellé
              <input className="y-champ" placeholder="ex. Réveil 4h" value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={100} />
            </label>
            <div className="y-form-ligne y-actions-ligne">
              <label className="y-label y-refl-champ">
                Heure
                <input type="time" className="y-champ y-champ-petit" value={heure} onChange={(e) => setHeure(e.target.value)} />
              </label>
              <label className="y-label y-refl-champ">
                Construction (facultatif)
                <select className="y-champ y-champ-petit" value={constructionId} onChange={(e) => setConstructionId(e.target.value)}>
                  <option value="">Aucune, rappel général</option>
                  {choix.map((c) => (
                    <option key={c.id_construction} value={c.id_construction}>{c.nom}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="y-refl-champ">
              <p className="y-label" id="rap-jours">Jours</p>
              <div className="y-rappel-jours" role="group" aria-labelledby="rap-jours">
                {JOURS.map((j) => (
                  <button
                    key={j.iso}
                    type="button"
                    className="y-puce"
                    aria-pressed={joursChoisis.has(j.iso)}
                    aria-label={j.nom}
                    onClick={() => toggleJour(j.iso)}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
              <p className="y-caption y-muted">{joursChoisis.size === 0 ? 'Choisis au moins un jour.' : libelleJours([...joursChoisis].join(','))}</p>
            </div>
            <button type="button" className="y-btn y-btn-principal" onClick={handleCreer} disabled={creationEnCours || !formulaireValide}>
              {creationEnCours ? 'Création…' : 'Créer le rappel'}
            </button>
          </section>

          <section className="y-section" aria-labelledby="rap-appareil">
            <h2 id="rap-appareil" className="y-overline y-muted">Sur cet appareil</h2>
            <p className="y-body y-muted">
              À faire une fois par appareil. Sur iPhone, ajoute d'abord Yiri à l'écran d'accueil.
            </p>
            <button type="button" className="y-btn y-btn-secondaire" onClick={handleActiver} disabled={activationEnCours}>
              {activationEnCours ? 'Activation…' : 'Activer les notifications'}
            </button>
            {statutActivation && (
              <p className={`y-caption${statutActivation === 'active' ? '' : ' y-muted'}`} role="status">
                {MESSAGES_ACTIVATION[statutActivation]}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
