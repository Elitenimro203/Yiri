import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import SessionTimer from '../components/SessionTimer';
import {
  Axe,
  EntreeSuivi,
  PILIER_LABELS,
  listProgrammes,
  listAxes,
  getGrilleSuivi,
  toggleCase,
  axeActifJourIndex,
  Programme,
  Bilan,
  listerMesReflexions,
} from '../api/programmes';
import { Saison, getSaisonActive, listerSaisons, creerSaison as _creerSaison } from '../api/seasons';
import {
  Construction,
  StatutConstruction,
  listerConstructions,
  creerConstruction,
  mettreEnPauseConstruction,
  reprendreConstruction,
  terminerConstruction,
  abandonnerConstruction,
} from '../api/constructions';
import { SessionTravail, getSessionActive } from '../api/sessions';
import { Engagement, TypeEngagement, listerEngagements, creerEngagement, modifierEngagement } from '../api/engagements';
import { Observation, listerObservations } from '../api/observations';
import { Action, listerActions, creerAction } from '../api/actions';
import { ApiError } from '../api/client';

void _creerSaison; // réservé (création de Saison se fait pour l'instant depuis Aujourd'hui / backend) — évite un import mort signalé par le linter

const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const STATUT_LABELS: Record<StatutConstruction, string> = {
  active: 'Active',
  en_pause: 'En pause',
  terminee: 'Terminée',
  abandonnee: 'Abandonnée',
};
const DECISION_LABELS: Record<string, string> = {
  avancer: 'Avancer', consolider: 'Consolider',
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};

// Fabrique un Axe minimal pour réutiliser SessionTimer sur une Construction
// qui n'a pas (ou plus) de notion de verrouillage hebdomadaire — voir
// components/SessionTimer.tsx, qui ne lit que id_axe et deverrouille.
function axePourSessionTimer(c: Construction, deverrouille: boolean): Axe {
  return {
    id_axe: c.id_construction, nom: c.nom, phase_deverrouillage: null,
    ordre_affichage: c.ordre_affichage, pilier: null, jours_actifs: null, deverrouille,
  };
}

export default function ConstructionsPage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [saisonActive, setSaisonActive] = useState<Saison | null>(null);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [axesLegacy, setAxesLegacy] = useState<Axe[]>([]); // détail Wakati (pilier/verrouillage) pour la Saison active
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [saisonsDispo, setSaisonsDispo] = useState<Saison[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toggleEnCours, setToggleEnCours] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<SessionTravail | null>(null);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const [engagementsParConstruction, setEngagementsParConstruction] = useState<Record<number, Engagement[]>>({});
  const [observationsParConstruction, setObservationsParConstruction] = useState<Record<number, Observation[]>>({});
  const [actionsParConstruction, setActionsParConstruction] = useState<Record<number, Action[]>>({});
  const [reflexionRecenteParConstruction, setReflexionRecenteParConstruction] = useState<Record<number, Bilan>>({});
  const [formOuvertPourId, setFormOuvertPourId] = useState<number | null>(null);
  const [descriptionForm, setDescriptionForm] = useState('');
  const [typeForm, setTypeForm] = useState<TypeEngagement>('recurrent');
  const [dateDebutForm, setDateDebutForm] = useState(() => new Date().toISOString().slice(0, 10));
  const [engagementEnCours, setEngagementEnCours] = useState(false);

  // Formulaire "+ Action" (Mission 6, §14) — indépendant du formulaire
  // Engagement ci-dessus, une Action n'impose jamais d'Engagement.
  const [formActionOuvertPourId, setFormActionOuvertPourId] = useState<number | null>(null);
  const [contenuActionForm, setContenuActionForm] = useState('');
  const [dateActionForm, setDateActionForm] = useState(() => new Date().toISOString().slice(0, 10));
  const [engagementLieForm, setEngagementLieForm] = useState<number | ''>('');
  const [actionEnvoiEnCours, setActionEnvoiEnCours] = useState(false);

  // Formulaire de création d'une Construction (§14)
  const [formCreationOuvert, setFormCreationOuvert] = useState(false);
  const [nomCreation, setNomCreation] = useState('');
  const [intentionCreation, setIntentionCreation] = useState('');
  const [saisonCreation, setSaisonCreation] = useState<number | ''>('');
  const [creationEnCours, setCreationEnCours] = useState(false);

  const chargerGrilleSemaine = useCallback(async (prog: Programme) => {
    const [axesData, entreesData] = await Promise.all([
      listAxes(prog.id_programme),
      getGrilleSuivi(prog.id_programme, prog.semaine_courante),
    ]);
    setAxesLegacy(axesData);
    setEntreesSemaine(entreesData);
  }, []);

  const chargerDetails = useCallback(async (liste: Construction[]) => {
    const [engListes, obsListes, actListes] = await Promise.all([
      Promise.all(liste.map((c) => listerEngagements(c.id_construction).catch(() => [] as Engagement[]))),
      Promise.all(liste.map((c) => listerObservations({ axeId: c.id_construction }).catch(() => [] as Observation[]))),
      Promise.all(liste.map((c) => listerActions({ axeId: c.id_construction }).catch(() => [] as Action[]))),
    ]);
    const engMap: Record<number, Engagement[]> = {};
    const obsMap: Record<number, Observation[]> = {};
    const actMap: Record<number, Action[]> = {};
    liste.forEach((c, i) => {
      engMap[c.id_construction] = engListes[i];
      obsMap[c.id_construction] = obsListes[i].slice(0, 3);
      actMap[c.id_construction] = actListes[i].slice(0, 5);
    });
    setEngagementsParConstruction(engMap);
    setObservationsParConstruction(obsMap);
    setActionsParConstruction(actMap);
  }, []);

  useEffect(() => {
    async function chargerTout() {
      const [saison, liste, programmes, toutesSaisons] = await Promise.all([
        getSaisonActive(),
        listerConstructions(),
        listProgrammes().catch(() => []),
        listerSaisons().catch(() => [] as Saison[]),
      ]);
      setSaisonActive(saison);
      setConstructions(liste);
      setSaisonsDispo(toutesSaisons);

      const progActif = programmes.find((p) => p.statut === 'actif') ?? null;
      setProgramme(progActif);
      if (progActif) await chargerGrilleSemaine(progActif);

      await chargerDetails(liste);

      // Réflexion récente par Construction — une seule requête pour tout
      // l'utilisateur (GET /bilans), regroupée côté client par id_axe.
      try {
        const toutes = await listerMesReflexions();
        const recentes: Record<number, Bilan> = {};
        for (const r of toutes) {
          if (r.id_axe != null && !recentes[r.id_axe]) recentes[r.id_axe] = r; // déjà triées par date desc côté API
        }
        setReflexionRecenteParConstruction(recentes);
      } catch {
        // silencieux — la réflexion récente est une bonification, pas critique
      }

      getSessionActive().then(setSessionActive).catch(() => {});
    }

    chargerTout()
      .catch(() => setErreur('Impossible de charger tes Constructions.'))
      .finally(() => setChargement(false));
  }, [chargerGrilleSemaine, chargerDetails]);

  async function rafraichirConstructions() {
    const liste = await listerConstructions();
    setConstructions(liste);
    await chargerDetails(liste);
  }

  async function handleToggle(axe: Axe, jour: number) {
    if (!programme || !axe.deverrouille) return;
    const cle = `${axe.id_axe}-${jour}`;
    setToggleEnCours(cle);
    try {
      await toggleCase(axe.id_axe, programme.semaine_courante, jour);
      await chargerGrilleSemaine(programme);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible d'enregistrer.");
    } finally {
      setToggleEnCours(null);
    }
  }

  async function handleChangerStatut(c: Construction, action: (id: number) => Promise<Construction>) {
    setActionEnCours(c.id_construction);
    try {
      const maj = await action(c.id_construction);
      setConstructions((prev) => prev.map((x) => (x.id_construction === maj.id_construction ? maj : x)));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : 'Impossible de modifier le statut.');
    } finally {
      setActionEnCours(null);
    }
  }

  async function handleCreerEngagement(constructionId: number) {
    if (!descriptionForm.trim()) return;
    setEngagementEnCours(true);
    try {
      const nouveau = await creerEngagement(constructionId, {
        description: descriptionForm.trim(),
        type: typeForm,
        date_debut: dateDebutForm,
      });
      setEngagementsParConstruction((prev) => ({ ...prev, [constructionId]: [...(prev[constructionId] ?? []), nouveau] }));
      setDescriptionForm('');
      setFormOuvertPourId(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible de créer l'engagement.");
    } finally {
      setEngagementEnCours(false);
    }
  }

  async function handleCreerAction(constructionId: number) {
    setActionEnvoiEnCours(true);
    try {
      const nouvelle = await creerAction({
        id_axe: constructionId,
        id_engagement: engagementLieForm || null,
        date_action: dateActionForm,
        contenu: contenuActionForm.trim() || null,
      });
      setActionsParConstruction((prev) => ({
        ...prev,
        [constructionId]: [nouvelle, ...(prev[constructionId] ?? [])].slice(0, 5),
      }));
      setContenuActionForm('');
      setEngagementLieForm('');
      setFormActionOuvertPourId(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible d'enregistrer l'action.");
    } finally {
      setActionEnvoiEnCours(false);
    }
  }

  async function handleToggleActifEngagement(engagement: Engagement) {
    try {
      const maj = await modifierEngagement(engagement.id_engagement, { actif: !engagement.actif });
      setEngagementsParConstruction((prev) => ({
        ...prev,
        [engagement.id_axe]: (prev[engagement.id_axe] ?? []).map((e) => (e.id_engagement === maj.id_engagement ? maj : e)),
      }));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : "Impossible de modifier l'engagement.");
    }
  }

  async function handleCreerConstruction() {
    if (!nomCreation.trim()) return;
    setCreationEnCours(true);
    try {
      await creerConstruction({
        nom: nomCreation.trim(),
        intention: intentionCreation.trim() || null,
        id_saison: saisonCreation === '' ? null : saisonCreation,
      });
      setNomCreation('');
      setIntentionCreation('');
      setSaisonCreation('');
      setFormCreationOuvert(false);
      await rafraichirConstructions();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.detail : 'Impossible de créer la Construction.');
    } finally {
      setCreationEnCours(false);
    }
  }

  const estCoche = (axeId: number, jour: number) => entreesSemaine.some((e) => e.id_axe === axeId && e.jour === jour && e.coche);
  const nbActionsRecentes = (axeId: number) => entreesSemaine.filter((e) => e.id_axe === axeId && e.coche).length;
  const axeLegacyDe = (c: Construction) => axesLegacy.find((a) => a.id_axe === c.id_construction);

  function renderCard(c: Construction) {
    const statut = c.statut ?? 'active';
    const axeLegacy = saisonActive && c.id_saison === saisonActive.id_saison ? axeLegacyDe(c) : undefined;
    const afficherGrilleHebdo = !!axeLegacy && axeLegacy.pilier !== null;
    const saisonDeCetteConstruction = c.id_saison === saisonActive?.id_saison
      ? saisonActive
      : saisonsDispo.find((s) => s.id_saison === c.id_saison);
    const reflexion = reflexionRecenteParConstruction[c.id_construction];

    return (
      <article key={c.id_construction} style={styles.card}>
        <div style={styles.cardHead}>
          <div>
            <div style={styles.nomRow}>
              <h3 style={styles.axeName}>{c.nom}</h3>
              <span style={styles.statutBadge}>{STATUT_LABELS[statut]}</span>
            </div>
            {c.intention && <p style={styles.intention}>{c.intention}</p>}
            <p style={styles.meta}>
              {saisonDeCetteConstruction ? `Saison : ${saisonDeCetteConstruction.nom}` : 'Hors Saison'}
              {axeLegacy?.pilier && <> · {PILIER_LABELS[axeLegacy.pilier]}</>}
              {afficherGrilleHebdo && <> · {nbActionsRecentes(c.id_construction)} action{nbActionsRecentes(c.id_construction) > 1 ? 's' : ''} cette semaine</>}
            </p>
            {axeLegacy && !axeLegacy.deverrouille && (
              <small style={styles.aVenir}>S'active en semaine {axeLegacy.phase_deverrouillage}</small>
            )}
          </div>
        </div>

        <div style={styles.statutActions}>
          {statut !== 'active' && (
            <button style={styles.statutBtn} disabled={actionEnCours === c.id_construction} onClick={() => handleChangerStatut(c, reprendreConstruction)}>Reprendre</button>
          )}
          {statut === 'active' && (
            <button style={styles.statutBtn} disabled={actionEnCours === c.id_construction} onClick={() => handleChangerStatut(c, mettreEnPauseConstruction)}>Mettre en pause</button>
          )}
          {statut !== 'terminee' && (
            <button style={styles.statutBtn} disabled={actionEnCours === c.id_construction} onClick={() => handleChangerStatut(c, terminerConstruction)}>Terminer</button>
          )}
          {statut !== 'abandonnee' && (
            <button style={styles.statutBtnDanger} disabled={actionEnCours === c.id_construction} onClick={() => handleChangerStatut(c, abandonnerConstruction)}>Abandonner</button>
          )}
        </div>

        {afficherGrilleHebdo && axeLegacy && (
          <div style={styles.week}>
            {NOMS_JOURS.map((nom, i) => {
              const actifCeJour = axeActifJourIndex(axeLegacy, i);
              const coche = estCoche(c.id_construction, i);
              const disabled = !axeLegacy.deverrouille || !actifCeJour || toggleEnCours === `${c.id_construction}-${i}`;
              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => handleToggle(axeLegacy, i)}
                  style={{
                    ...styles.dayBtn,
                    ...(coche ? styles.dayBtnDone : {}),
                    ...(!actifCeJour ? styles.dayBtnInactive : {}),
                    opacity: !axeLegacy.deverrouille ? 0.35 : !actifCeJour ? 0.3 : 1,
                  }}
                  title={!actifCeJour ? 'Pas programmé ce jour' : nom}
                >
                  <small>{nom}</small>
                  <span>{coche ? '✓' : '○'}</span>
                </button>
              );
            })}
          </div>
        )}

        <SessionTimer
          axe={axeLegacy ?? axePourSessionTimer(c, statut !== 'abandonnee' && statut !== 'terminee')}
          sessionActive={sessionActive}
          onChange={setSessionActive}
          onError={setErreur}
        />

        <div style={styles.engagementsBlock}>
          <div style={styles.engagementsHead}>
            <span style={styles.engagementsTitle}>Engagements</span>
            <button
              style={styles.engagementsAddBtn}
              onClick={() => setFormOuvertPourId(formOuvertPourId === c.id_construction ? null : c.id_construction)}
            >
              {formOuvertPourId === c.id_construction ? 'Annuler' : '+ Engagement'}
            </button>
          </div>

          {(engagementsParConstruction[c.id_construction] ?? []).length === 0 && formOuvertPourId !== c.id_construction && (
            <p style={styles.engagementsEmpty}>Aucun engagement défini pour l'instant.</p>
          )}

          {(engagementsParConstruction[c.id_construction] ?? []).map((e) => (
            <div key={e.id_engagement} style={{ ...styles.engagementItem, opacity: e.actif ? 1 : 0.5 }}>
              <div>
                <p style={styles.engagementDesc}>{e.description}</p>
                <small style={styles.engagementMeta}>
                  {e.type === 'recurrent' ? 'Récurrent' : 'Ponctuel'} · depuis le{' '}
                  {new Date(e.date_debut).toLocaleDateString('fr-FR')}
                  {e.date_fin && ` · jusqu'au ${new Date(e.date_fin).toLocaleDateString('fr-FR')}`}
                </small>
              </div>
              <button style={styles.engagementToggle} onClick={() => handleToggleActifEngagement(e)}>
                {e.actif ? 'Suspendre' : 'Reprendre'}
              </button>
            </div>
          ))}

          {formOuvertPourId === c.id_construction && (
            <div style={styles.engagementForm}>
              <textarea
                style={styles.engagementTextarea}
                placeholder="Ce que j'accepte concrètement de faire pour cette Construction…"
                value={descriptionForm}
                onChange={(ev) => setDescriptionForm(ev.target.value)}
                rows={2}
              />
              <div style={styles.engagementFormRow}>
                <select value={typeForm} onChange={(ev) => setTypeForm(ev.target.value as TypeEngagement)} style={styles.engagementSelect}>
                  <option value="recurrent">Récurrent</option>
                  <option value="ponctuel">Ponctuel</option>
                </select>
                <input type="date" value={dateDebutForm} onChange={(ev) => setDateDebutForm(ev.target.value)} style={styles.engagementDateInput} />
                <button onClick={() => handleCreerEngagement(c.id_construction)} disabled={engagementEnCours || !descriptionForm.trim()} style={styles.engagementSubmit}>
                  {engagementEnCours ? '…' : 'Ajouter'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.engagementsBlock}>
          <div style={styles.engagementsHead}>
            <span style={styles.engagementsTitle}>Actions récentes</span>
            <button
              style={styles.engagementsAddBtn}
              onClick={() => setFormActionOuvertPourId(formActionOuvertPourId === c.id_construction ? null : c.id_construction)}
            >
              {formActionOuvertPourId === c.id_construction ? 'Annuler' : '+ Action'}
            </button>
          </div>

          {(actionsParConstruction[c.id_construction] ?? []).length === 0 && formActionOuvertPourId !== c.id_construction && (
            <p style={styles.engagementsEmpty}>Rien d'enregistré pour l'instant.</p>
          )}

          {(actionsParConstruction[c.id_construction] ?? []).map((a) => (
            <div key={a.id_entree} style={styles.engagementItem}>
              <div>
                <p style={styles.engagementDesc}>{a.contenu || 'Action réalisée'}</p>
                <small style={styles.engagementMeta}>
                  {a.date_action && new Date(a.date_action).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </small>
              </div>
            </div>
          ))}

          {formActionOuvertPourId === c.id_construction && (
            <div style={styles.engagementForm}>
              <p style={styles.actionPrompt}>Qu'est-ce qui s'est passé ?</p>
              <textarea
                style={styles.engagementTextarea}
                placeholder="Ex. Conversation de 40 minutes en anglais…"
                value={contenuActionForm}
                onChange={(ev) => setContenuActionForm(ev.target.value)}
                rows={2}
              />
              <div style={styles.engagementFormRow}>
                <input type="date" value={dateActionForm} onChange={(ev) => setDateActionForm(ev.target.value)} style={styles.engagementDateInput} />
                <select
                  value={engagementLieForm}
                  onChange={(ev) => setEngagementLieForm(ev.target.value ? Number(ev.target.value) : '')}
                  style={styles.engagementSelect}
                >
                  <option value="">Engagement lié (facultatif)</option>
                  {(engagementsParConstruction[c.id_construction] ?? []).map((e) => (
                    <option key={e.id_engagement} value={e.id_engagement}>{e.description}</option>
                  ))}
                </select>
                <button onClick={() => handleCreerAction(c.id_construction)} disabled={actionEnvoiEnCours} style={styles.engagementSubmit}>
                  {actionEnvoiEnCours ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.observationsBlock}>
          <p style={styles.observationsTitle}>Observations récentes</p>
          {(observationsParConstruction[c.id_construction] ?? []).length === 0 ? (
            <p style={styles.observationsEmpty}>Rien de noté pour cette Construction.</p>
          ) : (
            (observationsParConstruction[c.id_construction] ?? []).map((o) => (
              <p key={o.id_observation} style={styles.observationsItem}>
                <small style={styles.observationsDate}>{new Date(o.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</small>{' '}
                « {o.contenu} »
              </p>
            ))
          )}
        </div>

        {reflexion && (
          <div style={styles.reflexionBlock}>
            <p style={styles.observationsTitle}>Réflexion récente</p>
            <p style={styles.observationsItem}>
              {reflexion.remarque && `« ${reflexion.remarque} » — `}
              Décision : {reflexion.type_decision ? DECISION_LABELS[reflexion.type_decision] : reflexion.decision ? DECISION_LABELS[reflexion.decision] : '—'}
            </p>
          </div>
        )}
      </article>
    );
  }

  const constructionsSaisonActuelle = saisonActive
    ? constructions.filter((c) => c.id_saison === saisonActive.id_saison)
    : [];
  const constructionsHorsSaisonActuelle = constructions.filter(
    (c) => !saisonActive || c.id_saison !== saisonActive.id_saison
  );

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Ce que tu fais évoluer</p>
        <h1 style={styles.h1}>Constructions</h1>
        <p style={styles.subtitle}>Qu'est-ce que je choisis actuellement de faire évoluer ?</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && (
          <>
            {constructions.length === 0 ? (
              <article style={styles.emptyCard}>
                <p style={styles.emptyText}>Aucune Construction pour l'instant.</p>
                <p style={styles.emptyQuestion}>Qu'est-ce que tu choisis actuellement de faire évoluer ?</p>
                <button style={styles.creerBtn} onClick={() => setFormCreationOuvert(true)}>+ Créer une Construction</button>
              </article>
            ) : (
              <div style={styles.sectionHead}>
                <button style={styles.creerBtn} onClick={() => setFormCreationOuvert((v) => !v)}>
                  {formCreationOuvert ? 'Annuler' : '+ Créer une Construction'}
                </button>
              </div>
            )}

            {formCreationOuvert && (
              <article style={styles.card}>
                <label style={styles.formLabel}>
                  Nom
                  <input style={styles.formInput} value={nomCreation} onChange={(e) => setNomCreation(e.target.value)} placeholder="Ex. Écriture, Course à pied, Portfolio…" />
                </label>
                <label style={styles.formLabel}>
                  Intention (facultatif)
                  <textarea style={styles.engagementTextarea} rows={2} value={intentionCreation} onChange={(e) => setIntentionCreation(e.target.value)} placeholder="Ce que je veux faire évoluer et pourquoi…" />
                </label>
                <label style={styles.formLabel}>
                  Saison (facultatif)
                  <select style={styles.engagementSelect} value={saisonCreation} onChange={(e) => setSaisonCreation(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Aucune (hors Saison)</option>
                    {saisonActive && <option value={saisonActive.id_saison}>{saisonActive.nom} (Saison actuelle)</option>}
                    {saisonsDispo.filter((s) => s.id_saison !== saisonActive?.id_saison).map((s) => (
                      <option key={s.id_saison} value={s.id_saison}>{s.nom}</option>
                    ))}
                  </select>
                </label>
                <button onClick={handleCreerConstruction} disabled={creationEnCours || !nomCreation.trim()} style={styles.engagementSubmit}>
                  {creationEnCours ? 'Création…' : 'Créer'}
                </button>
              </article>
            )}

            {saisonActive && (
              <>
                <div style={styles.sectionHead}><h3 style={styles.h3}>Constructions de la Saison actuelle</h3></div>
                <div style={styles.list}>
                  {constructionsSaisonActuelle.length === 0 && (
                    <p style={{ color: 'var(--text-muted)' }}>Aucune Construction dans cette Saison pour l'instant.</p>
                  )}
                  {constructionsSaisonActuelle.map(renderCard)}
                </div>
              </>
            )}

            {constructionsHorsSaisonActuelle.length > 0 && (
              <>
                <div style={styles.sectionHead}><h3 style={styles.h3}>Constructions hors Saison / en arrière-plan</h3></div>
                <div style={styles.list}>{constructionsHorsSaisonActuelle.map(renderCard)}</div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 900, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  emptyCard: { background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', padding: 28, textAlign: 'center', marginBottom: 20 },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 4px' },
  emptyQuestion: { fontFamily: 'var(--serif)', fontSize: 17, margin: '0 0 16px' },
  creerBtn: { background: 'var(--sprout)', color: '#161D14', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  formLabel: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 },
  formInput: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13 },
  sectionHead: { margin: '22px 2px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  h3: { margin: 0, fontSize: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 12 },
  cardHead: { marginBottom: 12 },
  nomRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  axeName: { margin: 0, fontSize: 15, fontFamily: 'var(--serif)' },
  statutBadge: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' },
  intention: { margin: '4px 0 0', fontSize: 12.5, color: 'var(--text)', fontStyle: 'italic' },
  meta: { margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 11.5 },
  aVenir: { color: 'var(--locked)', fontSize: 11 },
  statutActions: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  statutBtn: { background: 'none', border: '1px solid var(--line)', color: 'var(--text-muted)', borderRadius: 7, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' },
  statutBtnDanger: { background: 'none', border: '1px solid var(--line)', color: 'var(--error)', borderRadius: 7, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' },
  week: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 },
  dayBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 9, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 },
  dayBtnDone: { borderColor: 'var(--sprout-dim)', background: 'var(--surface-2)', color: 'var(--sprout)' },
  dayBtnInactive: { cursor: 'not-allowed' },
  engagementsBlock: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' },
  engagementsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  engagementsTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 },
  engagementsAddBtn: { background: 'none', border: '1px solid var(--line)', color: 'var(--sprout)', borderRadius: 7, padding: '4px 9px', fontSize: 11.5, cursor: 'pointer' },
  engagementsEmpty: { color: 'var(--text-muted)', fontSize: 12, margin: 0 },
  engagementItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' },
  engagementDesc: { margin: 0, fontSize: 13, color: 'var(--text)' },
  engagementMeta: { color: 'var(--text-muted)', fontSize: 10.5 },
  engagementToggle: { background: 'none', border: '1px solid var(--line)', color: 'var(--text-muted)', borderRadius: 7, padding: '4px 9px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' },
  engagementForm: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  engagementTextarea: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 9, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' },
  engagementFormRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  engagementSelect: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '6px 8px' },
  engagementDateInput: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '6px 8px' },
  engagementSubmit: { background: 'var(--sprout)', color: '#161D14', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  actionPrompt: { margin: '0 0 6px', fontSize: 12.5, color: 'var(--text)' },
  observationsBlock: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' },
  observationsTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, margin: '0 0 8px' },
  observationsEmpty: { color: 'var(--text-muted)', fontSize: 12, margin: 0 },
  observationsItem: { margin: '0 0 6px', fontSize: 12.5, color: 'var(--text)', fontStyle: 'italic' },
  observationsDate: { color: 'var(--text-muted)', fontStyle: 'normal', fontSize: 10.5 },
  reflexionBlock: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' },
};
