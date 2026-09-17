import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import WeekTimeline from '../components/WeekTimeline';
import GrowthCard from '../components/GrowthCard';
import { STAGES, stadeActuel } from '../components/GrowthPlant';
import {
  Programme,
  Axe,
  EntreeSuivi,
  PilierProgres,
  Bilan,
  Pilier,
  PILIERS,
  PILIER_LABELS,
  listProgrammes,
  listAxes,
  getPiliers,
  getGrilleSuivi,
  listBilans,
  nbJoursActifs,
  calculerRegularite,
} from '../api/programmes';

const ICONS: Record<Pilier, string> = { corps: '◉', esprit: '⌁', caractere: '◇', impact: '↗' };
const SEMAINES = [1, 2, 3, 4];

function jourIndexAujourdhui(): number {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
}

interface PointSemaine {
  semaine: number;
  valeur: number | null;
}

interface EvenementTimeline {
  date: Date;
  titre: string;
  detail?: string;
  type: 'saison' | 'action' | 'reflexion';
}

const DECISION_LABELS: Record<string, string> = {
  avancer: 'Avancer', consolider: 'Consolider',
  continuer: 'Continuer', modifier: 'Modifier', reduire: 'Réduire', suspendre: 'Suspendre',
  abandonner: 'Abandonner', approfondir: 'Approfondir', ne_rien_changer: 'Ne rien changer',
};

function libelleDecision(b: Bilan): string {
  const brute = b.decision ?? b.type_decision;
  return brute ? (DECISION_LABELS[brute] ?? brute) : '—';
}

const TIMELINE_DOT_COLOR: Record<EvenementTimeline['type'], string> = {
  saison: 'var(--bloom)',
  action: 'var(--sprout)',
  reflexion: 'var(--text-muted)',
};

function MiniChart({ points, actuelle }: { points: PointSemaine[]; actuelle: number }) {
  const w = 220;
  const h = 70;
  const padX = 12;
  const stepX = (w - padX * 2) / (SEMAINES.length - 1);

  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: p.valeur === null ? null : h - 10 - (p.valeur / 100) * (h - 20),
    semaine: p.semaine,
  }));

  const segments: string[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    if (coords[i].y === null || coords[i + 1].y === null) continue;
    segments.push(`M${coords[i].x},${coords[i].y} L${coords[i + 1].x},${coords[i + 1].y}`);
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={padX} y1={h - 10} x2={w - padX} y2={h - 10} stroke="var(--line)" strokeWidth={1} />
      {segments.map((d, i) => (
        <path key={i} d={d} stroke="var(--sprout)" strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}
      {coords.map((c, i) =>
        c.y === null ? null : (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={c.semaine === actuelle ? 4.5 : 3}
            fill={c.semaine === actuelle ? 'var(--bloom)' : 'var(--sprout)'}
          />
        )
      )}
    </svg>
  );
}

export default function TrajectoryPage() {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [axes, setAxes] = useState<Axe[]>([]);
  const [entreesSemaine, setEntreesSemaine] = useState<EntreeSuivi[]>([]);
  const [dataParPilier, setDataParPilier] = useState<Record<Pilier, PointSemaine[]>>({
    corps: [], esprit: [], caractere: [], impact: [],
  });
  const [lifetimeParSemaine, setLifetimeParSemaine] = useState<number[]>([]);
  const [evenements, setEvenements] = useState<EvenementTimeline[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const jourIdx = jourIndexAujourdhui();

  useEffect(() => {
    listProgrammes()
      .then(async (programmes) => {
        const actif = programmes.find((p) => p.statut === 'actif') ?? programmes[0];
        if (!actif) return;
        setProgramme(actif);

        const [axesData, piliersParSemaine, grillesParSemaine, bilans] = await Promise.all([
          listAxes(actif.id_programme),
          Promise.all(SEMAINES.map((s) => getPiliers(actif.id_programme, s).catch<PilierProgres[]>(() => []))),
          Promise.all(SEMAINES.map((s) => getGrilleSuivi(actif.id_programme, s).catch<EntreeSuivi[]>(() => []))),
          listBilans(actif.id_programme).catch<Bilan[]>(() => []),
        ]);
        setAxes(axesData);
        setEntreesSemaine(grillesParSemaine[actif.semaine_courante - 1] ?? []);

        const resultat: Record<Pilier, PointSemaine[]> = { corps: [], esprit: [], caractere: [], impact: [] };
        PILIERS.forEach((p) => {
          resultat[p] = SEMAINES.map((s, i) => {
            if (s > actif.semaine_courante) return { semaine: s, valeur: null };
            const trouve = piliersParSemaine[i].find((x) => x.pilier === p);
            return { semaine: s, valeur: trouve ? trouve.pourcentage : null };
          });
        });
        setDataParPilier(resultat);

        let cumul = 0;
        const cumulParSemaine = grillesParSemaine.map((grille) => {
          cumul += grille.filter((e) => e.coche).length;
          return cumul;
        });
        setLifetimeParSemaine(cumulParSemaine);

        // Chronologie factuelle : uniquement des événements réellement datés,
        // reconstruits à partir des données existantes (pas de nouvel
        // algorithme, pas de nouvelle entité). Les Engagements/Observations
        // n'existent pas encore côté backend — ils rejoindront cette
        // chronologie dès les phases B et C.
        const nomAxe = (id: number) => axesData.find((a) => a.id_axe === id)?.nom ?? 'Construction supprimée';

        const actionsParJour = new Map<string, string[]>();
        grillesParSemaine.flat().forEach((e) => {
          if (!e.coche || !e.date_coche) return;
          const cle = e.date_coche.slice(0, 10);
          const liste = actionsParJour.get(cle) ?? [];
          liste.push(nomAxe(e.id_axe));
          actionsParJour.set(cle, liste);
        });

        const evtActions: EvenementTimeline[] = [...actionsParJour.entries()].map(([iso, noms]) => ({
          date: new Date(iso),
          type: 'action',
          titre: `${noms.length} action${noms.length > 1 ? 's' : ''} réalisée${noms.length > 1 ? 's' : ''}`,
          detail: noms.join(' · '),
        }));

        const evtReflexions: EvenementTimeline[] = bilans.map((b) => ({
          date: new Date(b.date_creation),
          type: 'reflexion',
          titre: b.semaine !== null ? `Réflexion — semaine ${b.semaine}` : 'Réflexion',
          detail: `Décision : ${libelleDecision(b)}`,
        }));

        const evtSaison: EvenementTimeline = {
          date: new Date(actif.date_debut),
          type: 'saison',
          titre: `Saison commencée : ${actif.nom}`,
        };

        setEvenements(
          [evtSaison, ...evtActions, ...evtReflexions].sort((a, b) => b.date.getTime() - a.date.getTime())
        );
      })
      .catch(() => setErreur('Impossible de charger ta trajectoire.'))
      .finally(() => setChargement(false));
  }, []);

  const lifetimeActuel = lifetimeParSemaine[lifetimeParSemaine.length - 1] ?? 0;
  const { stage, index: stageIdx } = stadeActuel(lifetimeActuel);

  // Panneau "arbre" secondaire — mêmes calculs que l'ancien Dashboard, pour
  // la semaine courante uniquement (l'arbre reste une lecture de la semaine
  // en cours, pas un nouvel algorithme).
  const axesDeverrouilles = axes.filter((a) => a.deverrouille);
  const idsAxesDeverrouilles = new Set(axesDeverrouilles.map((a) => a.id_axe));
  const cocheesSemaine = entreesSemaine.filter((e) => e.coche && idsAxesDeverrouilles.has(e.id_axe)).length;
  const possiblesSemaine = axesDeverrouilles.reduce((total, a) => total + nbJoursActifs(a), 0);
  const regularite = calculerRegularite(axesDeverrouilles, entreesSemaine, jourIdx);

  return (
    <div style={styles.app}>
      <Sidebar />
      <main className="page-main" style={styles.main}>
        <p style={styles.eyebrow}>Le temps long</p>
        <h1 style={styles.h1}>Trajectoire</h1>
        <p style={styles.subtitle}>Qu'est-ce qui a changé dans ma vie au fil du temps ?</p>

        {chargement && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
        {erreur && <p style={{ color: 'var(--error)' }}>{erreur}</p>}

        {!chargement && !programme && (
          <article style={styles.emptyCard}>
            <p style={styles.emptyText}>Rien à montrer pour l'instant.</p>
            <p style={styles.emptyQuestion}>
              Cette page rassemblera bientôt ce qui s'est réellement passé au fil du temps — actions,
              observations, réflexions — à mesure que tu avances sur tes Constructions.
            </p>
          </article>
        )}

        {!chargement && programme && (
          <>
            <div style={styles.sectionHead}>
              <p style={styles.eyebrowSmall}>Cette semaine</p>
            </div>
            <WeekTimeline axesDeverrouilles={axesDeverrouilles} entrees={entreesSemaine} jourIndexAujourdhui={jourIdx} />

            <div style={styles.sectionHead}>
              <p style={styles.eyebrowSmall}>Chronologie</p>
              <h3 style={styles.h3}>Ce qui s'est réellement passé</h3>
            </div>
            <div style={styles.timeline}>
              {evenements.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>Rien à afficher pour l'instant.</p>
              )}
              {evenements.map((evt, i) => (
                <div key={i} style={styles.timelineItem}>
                  <div style={{ ...styles.timelineDot, background: TIMELINE_DOT_COLOR[evt.type] }} />
                  <div>
                    <div style={styles.timelineRow}>
                      <strong style={styles.timelineTitre}>{evt.titre}</strong>
                      <span style={styles.timelineDate}>
                        {evt.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {evt.detail && <p style={styles.timelineDetail}>{evt.detail}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.sectionHead}>
              <p style={styles.eyebrowSmall}>Piliers dans le temps</p>
              <h3 style={styles.h3}>Catégorisation, pas un score global</h3>
            </div>
            <section style={styles.grid}>
              {PILIERS.map((p) => (
                <article key={p} style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.icon}>{ICONS[p]}</span>
                    <h3 style={styles.pilierName}>{PILIER_LABELS[p]}</h3>
                  </div>
                  <MiniChart points={dataParPilier[p]} actuelle={programme.semaine_courante} />
                  <div style={styles.legend}>
                    {SEMAINES.map((s) => (
                      <span key={s} style={{ opacity: s <= programme.semaine_courante ? 1 : 0.4 }}>
                        S{s}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            <div style={styles.sectionHead}>
              <p style={styles.eyebrowSmall}>L'arbre — une interprétation, pas le moteur</p>
              <h3 style={styles.h3}>Ton stade de vie a évolué ainsi</h3>
            </div>

            <article style={styles.stepperCard}>
              <div style={styles.stepper}>
                {STAGES.map((s, i) => (
                  <div key={s.nom} style={styles.step}>
                    <div
                      style={{
                        ...styles.stepDot,
                        ...(i <= stageIdx ? styles.stepDotDone : {}),
                        ...(i === stageIdx ? styles.stepDotCurrent : {}),
                      }}
                    />
                    <small style={{ color: i <= stageIdx ? 'var(--text)' : 'var(--text-muted)' }}>{s.nom}</small>
                    {i < STAGES.length - 1 && (
                      <div style={{ ...styles.stepLine, ...(i < stageIdx ? styles.stepLineDone : {}) }} />
                    )}
                  </div>
                ))}
              </div>
              <p style={styles.stepperCaption}>
                {lifetimeActuel} actions réalisées depuis le début · stade actuel : <strong style={{ color: 'var(--sprout)' }}>{stage.nom}</strong>
              </p>
            </article>

            <div style={{ marginTop: 16 }}>
              <GrowthCard
                lifetimeCoches={lifetimeActuel}
                cocheesSemaine={cocheesSemaine}
                possiblesSemaine={possiblesSemaine}
                semaineCourante={programme.semaine_courante}
                regularitePourcentage={regularite.pourcentage}
              />
            </div>
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
  eyebrowSmall: { fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, margin: 0 },
  h1: { fontFamily: 'var(--serif)', fontSize: 27, margin: '6px 0 4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' },
  emptyCard: { background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  emptyText: { color: 'var(--text-muted)', fontSize: 13, margin: '0 0 6px' },
  emptyQuestion: { fontSize: 13.5, color: 'var(--text)', margin: 0, maxWidth: 480 },
  sectionHead: { margin: '28px 2px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  h3: { margin: 0, fontSize: 16 },
  timeline: { display: 'flex', flexDirection: 'column', gap: 4 },
  timelineItem: { display: 'flex', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--line)' },
  timelineDot: { width: 9, height: 9, borderRadius: '50%', marginTop: 5, flexShrink: 0 },
  timelineRow: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  timelineTitre: { fontSize: 13.5 },
  timelineDate: { fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  timelineDetail: { margin: '3px 0 0', color: 'var(--text-muted)', fontSize: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 10 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  icon: { color: 'var(--sprout)', fontSize: 15 },
  pilierName: { margin: 0, fontSize: 14, fontFamily: 'var(--serif)' },
  legend: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', padding: '0 12px' },
  stepperCard: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 24 },
  stepper: { display: 'flex', alignItems: 'center' },
  step: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
  stepDot: { width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--line)', background: 'var(--bg)', marginBottom: 8, zIndex: 1 },
  stepDotDone: { borderColor: 'var(--sprout)', background: 'var(--sprout-dim)' },
  stepDotCurrent: { borderColor: 'var(--bloom)', background: 'var(--bloom)' },
  stepLine: { position: 'absolute', top: 5, left: '55%', width: '90%', height: 2, background: 'var(--line)' },
  stepLineDone: { background: 'var(--sprout-dim)' },
  stepperCaption: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, marginTop: 16 },
};
