import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CarteConstruction from '../components/yiri/CarteConstruction';
import { useApparence } from '../design/apparence';
import '../design/yiri-tokens.css';
import '../design/yiri-ui.css';
import { Saison, getSaisonActive, listerSaisons, creerSaison, modifierSaison, terminerSaison } from '../api/seasons';
import { Construction, listerConstructions, creerConstruction } from '../api/constructions';
import { Engagement, listerEngagements, creerEngagement } from '../api/engagements';
import { Action, listerActions } from '../api/actions';
import { ApiError } from '../api/client';
import { aujourdhuiLocal } from '../lib/dates';
import { derniereTrace } from '../lib/traces';
import { grouperConstructions } from '../lib/constructions';

// Design 2a — « Qu'est-ce que je choisis actuellement de faire évoluer ? »
// La liste reste compacte : tout le détail d'une Construction (Engagements,
// traces, sessions, historique Wakati) vit sur sa propre page.
// Aucun reste Wakati ici : ni verrouillage « S'active en semaine N », ni
// compteur « N actions cette semaine », ni grille à cocher.

function messageErreur(e: unknown, defaut: string): string {
  return e instanceof ApiError && e.detail ? e.detail : defaut;
}

export default function ConstructionsPage() {
  const [apparence] = useApparence();
  // Venue depuis « Aujourd'hui » (premiers jours) : le formulaire s'ouvre
  // directement, et l'on y retourne une fois la Construction choisie.
  const [params] = useSearchParams();
  const depuisAujourdhui = params.get('choisir') === '1';
  const naviguer = useNavigate();
  const aujourdhui = aujourdhuiLocal();

  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [engagements, setEngagements] = useState<Record<number, Engagement[]>>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Saison : création ou modification
  const [formSaison, setFormSaison] = useState<'creer' | 'modifier' | null>(null);
  const [nomSaison, setNomSaison] = useState('');
  const [phraseSaison, setPhraseSaison] = useState('');
  const [debutSaison, setDebutSaison] = useState(aujourdhui);
  const [envoiSaison, setEnvoiSaison] = useState(false);

  // Construction : création
  const [formCreation, setFormCreation] = useState(depuisAujourdhui);
  const [engagementCreation, setEngagementCreation] = useState('');
  const [nomCreation, setNomCreation] = useState('');
  const [intentionCreation, setIntentionCreation] = useState('');
  const [saisonCreation, setSaisonCreation] = useState<number | ''>('');
  const [envoiCreation, setEnvoiCreation] = useState(false);

  async function charger() {
    const [saison, toutes, liste, acts] = await Promise.all([
      getSaisonActive().catch(() => null),
      listerSaisons().catch(() => [] as Saison[]),
      listerConstructions(),
      listerActions().catch(() => [] as Action[]),
    ]);
    setSaisonActive(saison);
    setSaisons(toutes);
    setConstructions(liste);
    setActions(acts);
    const listes = await Promise.all(liste.map((c) => listerEngagements(c.id_construction).catch(() => [] as Engagement[])));
    const map: Record<number, Engagement[]> = {};
    liste.forEach((c, i) => { map[c.id_construction] = listes[i].filter((e) => e.actif); });
    setEngagements(map);
  }

  useEffect(() => {
    charger()
      .catch(() => setErreur('Impossible de charger tes Constructions.'))
      .finally(() => setChargement(false));
  }, []);

  function ouvrirFormSaison(mode: 'creer' | 'modifier') {
    setFormSaison(mode);
    setNomSaison(mode === 'modifier' ? saisonActive?.nom ?? '' : '');
    setPhraseSaison(mode === 'modifier' ? saisonActive?.intention ?? '' : '');
    setDebutSaison(aujourdhui);
  }

  async function enregistrerSaison() {
    if (!nomSaison.trim()) return;
    setEnvoiSaison(true);
    setErreur(null);
    try {
      const phrase = phraseSaison.trim() || null;
      const saison = formSaison === 'modifier' && saisonActive
        ? await modifierSaison(saisonActive.id_saison, { nom: nomSaison.trim(), intention: phrase })
        : await creerSaison({ nom: nomSaison.trim(), intention: phrase, date_debut: debutSaison });
      setSaisonActive(saison);
      setFormSaison(null);
      setSaisons(await listerSaisons().catch(() => saisons));
    } catch (e) {
      setErreur(messageErreur(e, "Impossible d'enregistrer la Saison."));
    } finally {
      setEnvoiSaison(false);
    }
  }

  async function terminerLaSaison() {
    if (!saisonActive) return;
    if (!window.confirm(`Terminer la Saison « ${saisonActive.nom} » ? Ses Constructions restent là, elles ne sont simplement plus rattachées à une Saison en cours.`)) return;
    setEnvoiSaison(true);
    try {
      await terminerSaison(saisonActive.id_saison);
      setSaisonActive(null);
      setFormSaison(null);
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de terminer la Saison.'));
    } finally {
      setEnvoiSaison(false);
    }
  }

  async function creerLaConstruction() {
    if (!nomCreation.trim()) return;
    setEnvoiCreation(true);
    setErreur(null);
    try {
      const creee = await creerConstruction({
        nom: nomCreation.trim(),
        intention: intentionCreation.trim() || null,
        id_saison: saisonCreation === '' ? null : saisonCreation,
      });
      if (engagementCreation.trim()) {
        await creerEngagement(creee.id_construction, { description: engagementCreation.trim(), date_debut: aujourdhui });
      }
      if (depuisAujourdhui) {
        naviguer('/today');
        return;
      }
      setNomCreation('');
      setEngagementCreation('');
      setIntentionCreation('');
      setSaisonCreation('');
      setFormCreation(false);
      setConstructions(await listerConstructions());
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de créer la Construction.'));
    } finally {
      setEnvoiCreation(false);
    }
  }

  const groupes = grouperConstructions(constructions, saisonActive?.id_saison ?? null);
  const carte = (c: Construction, i: number) => (
    <CarteConstruction
      key={c.id_construction}
      construction={c}
      index={i}
      engagements={engagements[c.id_construction] ?? []}
      derniereTrace={derniereTrace(actions, c.id_construction)}
      aujourdhui={aujourdhui}
    />
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="page-main yiri" data-yiri-theme={apparence.theme} style={{ flex: 1, width: '100%', padding: 0 }}>
        <div className="y-page">
          <header className="y-entete-page">
            <p className="y-overline">Constructions</p>
            <h1 className="y-question">Qu'est-ce que tu choisis de faire évoluer&#8239;?</h1>
          </header>

          {erreur && <p className="y-erreur" role="alert">{erreur}</p>}
          {chargement && <p className="y-muted">Chargement…</p>}

          {!chargement && (
            <>
              {/* ---- Saison ---- (attend la première Construction : une notion à la fois) */}
              {(saisonActive || formSaison || constructions.length > 0) && (
              <section className="y-section" aria-labelledby="titre-saison">
                <h2 id="titre-saison" className="y-overline y-muted">Saison</h2>
                {formSaison ? (
                  <div className="y-carte-saison">
                    <label className="y-section">
                      <span className="y-label y-muted">Son nom</span>
                      <input className="y-champ" value={nomSaison} onChange={(e) => setNomSaison(e.target.value)} placeholder="Ex. Poser les bases" autoFocus />
                    </label>
                    <label className="y-section">
                      <span className="y-label y-muted">Ta phrase pour cette période (facultatif)</span>
                      <textarea className="y-champ y-champ-zone" value={phraseSaison} onChange={(e) => setPhraseSaison(e.target.value)} placeholder="Ce qui mérite particulièrement ton attention pendant cette période…" />
                      <span className="y-caption y-muted">Elle s'affichera sur Aujourd'hui.</span>
                    </label>
                    {formSaison === 'creer' && (
                      <label className="y-section">
                        <span className="y-label y-muted">Elle commence le</span>
                        <input className="y-champ y-champ-petit" type="date" value={debutSaison} onChange={(e) => setDebutSaison(e.target.value)} />
                      </label>
                    )}
                    <div className="y-actions-ligne">
                      <button type="button" className="y-btn y-btn-principal" onClick={enregistrerSaison} disabled={envoiSaison || !nomSaison.trim()}>
                        {formSaison === 'creer' ? 'Commencer la Saison' : 'Enregistrer'}
                      </button>
                      <button type="button" className="y-btn y-btn-texte" onClick={() => setFormSaison(null)}>Annuler</button>
                    </div>
                  </div>
                ) : saisonActive ? (
                  <div className="y-carte-saison">
                    <p className="y-title-card">{saisonActive.nom}</p>
                    <p className="y-caption y-muted">
                      Depuis le {new Date(`${saisonActive.date_debut.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {saisonActive.intention
                      ? <p className="y-phrase-texte">{saisonActive.intention}</p>
                      : <p className="y-label y-muted">Pas encore de phrase pour cette Saison.</p>}
                    <div className="y-actions-ligne">
                      <button type="button" className="y-btn y-btn-secondaire" onClick={() => ouvrirFormSaison('modifier')}>Modifier</button>
                      <button type="button" className="y-btn y-btn-texte" onClick={terminerLaSaison} disabled={envoiSaison}>Terminer la Saison</button>
                    </div>
                  </div>
                ) : (
                  <div className="y-carte-note">
                    <p className="y-body">Pas de Saison en cours.</p>
                    <p className="y-label y-muted">
                      Une Saison donne un contexte à une période de ta vie et aide à dire ce qui compte pendant ce temps. C'est facultatif : tout fonctionne sans.
                    </p>
                    <div><button type="button" className="y-btn y-btn-secondaire" onClick={() => ouvrirFormSaison('creer')}>Commencer une Saison</button></div>
                  </div>
                )}
              </section>
              )}

              {/* ---- Constructions ---- */}
              {constructions.length === 0 && !formCreation ? (
                <button type="button" className="y-lien-carte" onClick={() => setFormCreation(true)} style={{ background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                  <span className="y-caption y-muted">Quand tu seras prêt</span>
                  <span className="y-body" style={{ fontWeight: 600 }}>Choisir une chose à faire évoluer →</span>
                  <span className="y-label y-muted">Une capacité, une pratique, un projet, une relation… Pas besoin d'objectif chiffré.</span>
                </button>
              ) : (
                <div>
                  <button type="button" className="y-btn y-btn-secondaire" onClick={() => (formCreation && depuisAujourdhui ? naviguer('/today') : setFormCreation((v) => !v))} aria-expanded={formCreation}>
                    {formCreation ? 'Annuler' : '+ Choisir une chose à faire évoluer'}
                  </button>
                </div>
              )}

              {formCreation && (
                <div className="y-carte-saison">
                  <label className="y-section">
                    <span className="y-label y-muted">Son nom</span>
                    <input className="y-champ" value={nomCreation} onChange={(e) => setNomCreation(e.target.value)} placeholder="Ex. Anglais oral, Écriture, Ma relation avec mon frère…" autoFocus aria-describedby="aide-nom-construction" />
                    <span id="aide-nom-construction" className="y-caption y-muted">Une langue, un sport, un projet, une relation… Ce que tu veux faire progresser, sans objectif chiffré.</span>
                  </label>
                  {/* Première Construction : seulement son nom (une notion à la fois).
                      L'Engagement reste disponible ensuite, sur sa page. */}
                  {constructions.length > 0 && (
                  <label className="y-section">
                    <span className="y-label y-muted">Ce que tu acceptes de faire (facultatif)</span>
                    <input className="y-champ" value={engagementCreation} onChange={(e) => setEngagementCreation(e.target.value)} placeholder="Ex. 20 min de conversation, 3 fois par semaine" aria-describedby="aide-engagement-creation" />
                    <span id="aide-engagement-creation" className="y-caption y-muted">Tu pourras le préciser, le changer ou le suspendre à tout moment.</span>
                  </label>
                  )}
                  {constructions.length > 0 && (
                  <label className="y-section">
                    <span className="y-label y-muted">Pourquoi elle compte pour toi (facultatif)</span>
                    <textarea className="y-champ y-champ-zone" value={intentionCreation} onChange={(e) => setIntentionCreation(e.target.value)} />
                  </label>
                  )}
                  {saisons.length > 0 && (
                    <label className="y-section">
                      <span className="y-label y-muted">Saison (facultatif)</span>
                      <select className="y-champ" value={saisonCreation} onChange={(e) => setSaisonCreation(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">Aucune</option>
                        {saisonActive && <option value={saisonActive.id_saison}>{saisonActive.nom} (en cours)</option>}
                        {saisons.filter((s) => s.id_saison !== saisonActive?.id_saison).map((s) => (
                          <option key={s.id_saison} value={s.id_saison}>{s.nom}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div><button type="button" className="y-btn y-btn-principal" onClick={creerLaConstruction} disabled={envoiCreation || !nomCreation.trim()}>C'est choisi</button></div>
                </div>
              )}

              {groupes.saison.length > 0 && (
                <section className="y-section" aria-labelledby="titre-de-la-saison">
                  <h2 id="titre-de-la-saison" className="y-overline y-muted">De cette Saison</h2>
                  {groupes.saison.map(carte)}
                </section>
              )}

              {groupes.horsSaison.length > 0 && (
                <section className="y-section" aria-labelledby="titre-hors-saison">
                  <h2 id="titre-hors-saison" className="y-overline y-muted">{saisonActive ? 'Hors Saison' : 'En ce moment'}</h2>
                  {groupes.horsSaison.map((c, i) => carte(c, i + groupes.saison.length))}
                </section>
              )}

              {groupes.closes.length > 0 && (
                <details className="y-details">
                  <summary>Terminées ou abandonnées ({groupes.closes.length})</summary>
                  <div className="y-section">
                    <p className="y-caption y-muted">Abandonner peut être une décision juste. Elles restent dans ta trajectoire.</p>
                    {groupes.closes.map(carte)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
