import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import GrowthCard from '../components/GrowthCard';
import RitualToday from '../components/RitualToday';
import PillarsGrid from '../components/PillarsGrid';
import WeekTimeline from '../components/WeekTimeline';
import ModeSwitch from '../components/ModeSwitch';
import MantraCard from '../components/MantraCard';
import {
  Programme,
  Axe,
  EntreeSuivi,
  PilierProgres,
  ModeDeverrouillage,
  listProgrammes,
  listAxes,
  getGrilleSuivi,
  getPiliers,
  toggleCase,
  patchProgramme,
  nbJoursActifs,
  calculerRegularite,
  calculerRegulariteParPilier,
} from '../api/programmes';
import { ApiError } from '../api/client';

function jourIndexAujourdhui(): number {
  const jsDay = new Date().getDay(); // 0 = dimanche
  return (jsDay + 6) % 7; // 0 = lundi ... 6 = dimanche
}

export default function DashboardPage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [axes, setAxes] = useState<Axe[]>([]);
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [piliers, setPiliers] = useState<PilierProgres[]>([]);
  const [lifetimeCoches, setLifetimeCoches] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toggleEnCours, setToggleEnCours] = useState<number | null>(null);
  const [modeEnCours, setModeEnCours] = useState(false);

  const jourIdx = jourIndexAujourdhui();

  const chargerTout = useCallback(async (prog: Programme) => {
    const semaine = prog.semaine_courante;

    const [axesData, entreesData, piliersData] = await Promise.all([
      listAxes(prog.id_programme),
      getGrilleSuivi(prog.id_programme, semaine),
      getPiliers(prog.id_programme, semaine),
    ]);
    setAxes(axesData);
    setEntreesSemaine(entreesData);
    setPiliers(piliersData);

    // Lifetime = somme de TOUTES les cases cochées, sur les 4 semaines du plan,
    // recalculée à chaque fois depuis la source de vérité (pas un compteur à
    // part qui pourrait diverger des données réelles).
    const grilles = await Promise.all([1, 2, 3, 4].map((s) => getGrilleSuivi(prog.id_programme, s).catch(() => [])));
    const total = grilles.flat().filter((e) => e.coche).length;
    setLifetimeCoches(total);
  }, []);

  useEffect(() => {
    listProgrammes()
      .then(async (programmes) => {
        const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
        if (!actif) {
          setChargement(false);
          return;
        }
        setProgramme(actif);
        await chargerTout(actif);
      })
      .catch(() => setErreur('Impossible de charger ton programme.'))
      .finally(() => setChargement(false));
  }, [chargerTout]);

  async function handleToggle(axeId: number) {
    if (!programme) return;
    setToggleEnCours(axeId);
    try {
      await toggleCase(axeId, programme.semaine_courante, jourIdx);
      await chargerTout(programme);
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        setErreur(err.detail); // "Cet axe se débloque en semaine X"
      } else {
        setErreur("Impossible d'enregistrer — réessaie.");
      }
    } finally {
      setToggleEnCours(null);
    }
  }

  async function handleModeChange(mode: ModeDeverrouillage) {
    if (!programme || programme.mode_deverrouillage === mode) return;
    setModeEnCours(true);
    try {
      const maj = await patchProgramme(programme.id_programme, { mode_deverrouillage: mode });
      setProgramme(maj);
      await chargerTout(maj);
    } catch {
      setErreur('Impossible de changer le mode.');
    } finally {
      setModeEnCours(false);
    }
  }

  const axesDeverrouilles = axes.filter((a) => a.deverrouille);
  const idsAxesDeverrouilles = new Set(axesDeverrouilles.map((a) => a.id_axe));
  // Ne compter que les cases des axes ACTUELLEMENT déverrouillés — sinon une
  // case cochée pendant un test en mode "Complet" (sur un axe depuis reverrouillé)
  // gonfle le numérateur sans être représentée dans le dénominateur, produisant
  // un pourcentage incohérent avec les cartes par pilier (qui filtrent déjà correctement).
  const cocheesSemaine = entreesSemaine.filter((e) => e.coche && idsAxesDeverrouilles.has(e.id_axe)).length;
  const possiblesSemaine = axesDeverrouilles.reduce((total, a) => total + nbJoursActifs(a), 0);
  const regularite = calculerRegularite(axesDeverrouilles, entreesSemaine, jourIdx);
  const regularitesParPilier = calculerRegulariteParPilier(axesDeverrouilles, entreesSemaine, jourIdx);

  return (
    <div style={styles.app}>
      <Sidebar />

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div>
            <p style={styles.dateLabel}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <h1 style={styles.h1}>Continue de cultiver.</h1>
          </div>
        </header>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}

        {!chargement && erreur && (
          <p style={{ color: 'var(--error)', marginBottom: 16 }}>{erreur}</p>
        )}

        {!chargement && !programme && (
          <p style={{ color: 'var(--text-muted)' }}>Aucun programme actif pour l'instant.</p>
        )}

        {programme && (
          <>
            <section style={styles.hero}>
              <GrowthCard
                lifetimeCoches={lifetimeCoches}
                cocheesSemaine={cocheesSemaine}
                possiblesSemaine={possiblesSemaine}
                semaineCourante={programme.semaine_courante}
                regularitePourcentage={regularite.pourcentage}
              />
              <RitualToday
                axesDeverrouilles={axesDeverrouilles}
                entrees={entreesSemaine}
                jourIndex={jourIdx}
                onToggle={handleToggle}
                enCoursId={toggleEnCours}
              />
            </section>

            <div style={styles.sectionHead}>
              <div>
                <p style={styles.eyebrow}>Les racines</p>
                <h3 style={styles.h3}>Les 4 dimensions que tu cultives</h3>
              </div>
            </div>
            <PillarsGrid progres={piliers} regularites={regularitesParPilier} />

            <div style={styles.sectionHead}>
              <div>
                <p style={styles.eyebrow}>Le temps long</p>
                <h3 style={styles.h3}>Ta semaine comme une trajectoire</h3>
              </div>
            </div>
            <WeekTimeline axesDeverrouilles={axesDeverrouilles} entrees={entreesSemaine} jourIndexAujourdhui={jourIdx} />

            <div style={styles.bottom}>
              <MantraCard />
              <ModeSwitch mode={programme.mode_deverrouillage} onChange={handleModeChange} enCours={modeEnCours} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', minHeight: '100vh' },
  main: { flex: 1, maxWidth: 1100, margin: '0 auto', padding: '28px 36px 60px', width: '100%' },
  topbar: { marginBottom: 26 },
  eyebrow: { fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sprout)', fontWeight: 700, margin: 0 },
  dateLabel: { fontSize: 12, textTransform: 'capitalize', color: 'var(--text-muted)', margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 0' },
  hero: { display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(300px,0.9fr)', gap: 16, marginBottom: 26 },
  sectionHead: { margin: '30px 2px 12px' },
  h3: { margin: 0, fontSize: 16 },
  bottom: { marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
};
