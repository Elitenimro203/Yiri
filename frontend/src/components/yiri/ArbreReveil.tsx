import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { doux, rebond, poser, positionAccroche, pousserArbre, surCourbe, TEMPO, type Arbre, type Pose } from './arbreGeneratif';

// Arbre de l'écran d'attente : une graine, un arbre qui pousse (trait de
// plume, léger lavis, feuillage de points qui éclot du cœur vers l'extérieur),
// un fruit qui mûrit, tombe, s'écrase un peu, roule au centre et devient la
// graine de l'arbre suivant. Chaque arbre est différent.
//
// Purement symbolique (vision §17, §30) : il ne reflète AUCUNE donnée de la
// personne, rien ne se mérite ni ne se perd. Couleurs lues dans le thème.
// Téléphones modestes : cadence adaptative (60 → 30 images/s si l'appareil
// peine), résolution plafonnée, pause quand l'onglet est caché, arbre
// immobile si l'appareil demande moins d'animations.

type Rgb = [number, number, number];

/** Pilotage de la sortie : l'arbre achève sa pousse en accéléré (moins d'une
 *  seconde) jusqu'au fruit mûr, puis se dissout ; la promesse rend alors la
 *  position (écran) du fruit, pour qu'il rejoigne la page qui apparaît. */
export interface ArbreReveilHandle { sortir(): Promise<{ x: number; y: number }> }

const DUREE_SORTIE_MS = 650;
const ACCELERE_MAX_MS = 900;   // au plus une seconde de plus pour finir l'arbre
const GRAVITE = 1400;        // px/s²
const RAYON_FRUIT = 6.5;

function hexVersRgb(valeur: string, defaut: Rgb): Rgb {
  const h = valeur.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return defaut;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const melange = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgba = (c: Rgb, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// Chronologie du fruit, relative à la fin de la pousse.
function chrono(arbre: Arbre, sol: number, yFruit: number) {
  const mur = arbre.finPousse + 300 * TEMPO;
  const chute = mur + 1500 * TEMPO;
  const dureeChute = Math.sqrt((2 * Math.max(20, sol - RAYON_FRUIT - yFruit)) / GRAVITE) * 1000;
  const sol1 = chute + dureeChute;
  const rebondFin = sol1 + 320;
  const roule = rebondFin + 850 * TEMPO + 150;
  // L'arbre suivant naît dès que le fruit atteint le centre : pas de temps mort.
  return { mur, chute, dureeChute, sol1, rebondFin, roule, fin: roule };
}

const ArbreReveil = forwardRef<ArbreReveilHandle>(function ArbreReveil(_props, ref) {
  const toile = useRef<HTMLCanvasElement>(null);
  const pilote = useRef<ArbreReveilHandle>({ sortir: async () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) });
  useImperativeHandle(ref, () => ({ sortir: () => pilote.current.sortir() }), []);

  useEffect(() => {
    const canvas = toile.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(canvas);
    const encre = hexVersRgb(styles.getPropertyValue('--y-ink'), [17, 18, 20]);
    const accent = hexVersRgb(styles.getPropertyValue('--y-accent'), [35, 70, 184]);
    const fond = hexVersRgb(styles.getPropertyValue('--y-bg'), [255, 255, 255]);
    const ligne = hexVersRgb(styles.getPropertyValue('--y-line'), [230, 231, 234]);
    const accentClair = melange(accent, fond, 0.35);
    const sombre = (fond[0] + fond[1] + fond[2]) / 3 < 128;
    const forceLavis = sombre ? 0.55 : 1;
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let L = 0, H = 0, sol = 0;
    const dimensionner = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      L = canvas.clientWidth; H = canvas.clientHeight; sol = H - 28;
      canvas.width = Math.round(L * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    dimensionner();

    let numero = 1;
    let arbre = pousserArbre(numero, L / 2, sol, H, L);
    // Calculés une fois par arbre, pas à chaque image.
    // Feuilles regroupées en 2 teintes × 6 niveaux d'opacité.
    type Groupes = Map<string, number[]> & Map<string, number[]>;
    let cache = { repos: [] as Pose[], c: chrono(arbre, sol, 0), groupes: [] as [[boolean, number], number[]][] };
    const preparer = () => {
      const repos = poser(arbre, L / 2, sol, () => 0);
      const parCle: Groupes = new Map();
      arbre.feuilles.forEach((f, i) => {
        const niveau = Math.round(f.alpha * 6) / 6;
        const cle = `${f.clair ? 1 : 0}|${niveau}`;
        if (!parCle.has(cle)) parCle.set(cle, []);
        parCle.get(cle)!.push(i);
      });
      cache = {
        repos,
        c: chrono(arbre, sol, positionAccroche(repos, arbre, arbre.feuilles[arbre.porteFruit])[1]),
        groupes: [...parCle.entries()].map(([cle, ind]) => {
          const [clair, niveau] = cle.split('|');
          return [[clair === '1', Number(niveau)], ind] as [[boolean, number], number[]];
        }),
      };
    };
    preparer();
    // L'arbre suivant est calculé à l'avance, quand le navigateur est libre.
    let prochain: Arbre | null = null;
    let calculEnCours = false;
    const anticiper = () => {
      if (prochain || calculEnCours) return;
      calculEnCours = true;
      const calculer = () => { prochain = pousserArbre(numero + 1, L / 2, sol, H, L); calculEnCours = false; };
      const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(calculer, { timeout: 1500 }); else window.setTimeout(calculer, 0);
    };
    let graineAuSol = false;   // les cycles suivants partent du fruit tombé au centre
    let debut = performance.now();
    let sortie: number | null = null;
    let tCourant = 0;
    let fruitVisible: [number, number] | null = null;

    // Trait de plume : une forme pleine, épaisse à la naissance, fine à
    // l'arrivée, avec une pression légèrement irrégulière.
    const dessinerBranche = (p: Pose, b: Arbre['branches'][number], k: number, alpha: number, e: number) => {
      // Les branches fines n'ont pas besoin d'autant de points que le tronc.
      const n = Math.max(3, Math.ceil((b.prof < 2 ? 12 : 6) * k));
      const gauche: [number, number][] = [];
      const droite: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * k;
        const v = 1 - u;
        const x = v * v * p.x0 + 2 * v * u * p.cx + u * u * p.x1;
        const y = v * v * p.y0 + 2 * v * u * p.cy + u * u * p.y1;
        // Tangente de la courbe (dérivée), normalisée : la normale sans trigonométrie.
        let tx = 2 * v * (p.cx - p.x0) + 2 * u * (p.x1 - p.cx);
        let ty = 2 * v * (p.cy - p.y0) + 2 * u * (p.y1 - p.cy);
        const lg = Math.hypot(tx, ty) || 1; tx /= lg; ty /= lg;
        const w = ((b.epDebut + (b.epFin - b.epDebut) * u) * e * b.pression * (1 + 0.07 * Math.sin(u * 9 + b.debut))) / 2;
        gauche.push([x - ty * w, y + tx * w]);
        droite.push([x + ty * w, y - tx * w]);
      }
      ctx.fillStyle = rgba(encre, alpha);
      ctx.beginPath();
      ctx.moveTo(gauche[0][0], gauche[0][1]);
      for (const q of gauche) ctx.lineTo(q[0], q[1]);
      for (let i = droite.length - 1; i >= 0; i--) ctx.lineTo(droite[i][0], droite[i][1]);
      ctx.closePath(); ctx.fill();
      // Jonction douce avec la branche mère.
      ctx.beginPath(); ctx.arc(p.x0, p.y0, (b.epDebut * e * b.pression) / 2, 0, Math.PI * 2); ctx.fill();
    };

    const dessiner = (t: number, s = 0) => {
      ctx.clearRect(0, 0, L, H);
      const e = arbre.echelle;
      const { repos, c } = cache;
      const fonduArbre = t > c.sol1 ? Math.max(0, 1 - (t - c.sol1) / 750) : 1;
      const fondu = fonduArbre * (1 - doux(s * 1.4));

      ctx.globalAlpha = 1 - s;
      ctx.strokeStyle = rgba(ligne, 1); ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L / 2 - 90, sol); ctx.lineTo(L / 2 + 90, sol); ctx.stroke();
      ctx.globalAlpha = 1;

      // Vent : plie davantage vers les extrémités, avec un retard par génération.
      const vent = calme ? () => 0 : (prof: number) =>
        0.0065 * Math.pow(prof + 1, 1.25) * Math.sin(t / 1700 - prof * 0.45) * doux((t - arbre.finPousse + 1600) / 1600);
      const poses = poser(arbre, L / 2, sol, vent);

      for (const q of arbre.taches) {
        const k = doux((t - q.debut) / 1800);
        if (k <= 0) continue;
        const [x, y] = positionAccroche(poses, arbre, q);
        ctx.fillStyle = rgba(accent, q.alpha * forceLavis * fondu);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i, y - i * 0.7, q.r * e * k * (1 - i * 0.15), 0, Math.PI * 2); ctx.fill(); }
      }
      arbre.branches.forEach((b, i) => {
        const k = doux((t - b.debut) / b.duree);
        if (k <= 0) return;
        const p = poses[i];
        // Lavis : trait léger et décalé, comme l'encre qui a bu le papier.
        // Seulement sur les grosses branches : invisible sur les fines.
        if (b.prof < 3) {
        ctx.strokeStyle = rgba(encre, 0.09 * forceLavis * fondu);
        ctx.lineWidth = Math.max(0.8, b.epDebut * e * 1.5);
        ctx.beginPath(); ctx.moveTo(p.x0 + 1.2, p.y0);
        for (let j = 1; j <= 8 * k; j++) { const q = surCourbe(p, j / 8); ctx.lineTo(q[0] + 1.2, q[1]); }
        ctx.stroke();
        }
        dessinerBranche(p, b, k, 0.92 * fondu, e);
      });
      // Feuillage regroupé par teinte : une douzaine de remplissages par image
      // au lieu d'un par feuille.
      const opacite = fonduArbre * (1 - s);
      if (opacite > 0) {
        for (const [cle, indices] of cache.groupes) {
          const [clair, niveau] = cle;
          ctx.fillStyle = rgba(clair ? accentClair : accent, niveau * opacite);
          ctx.beginPath();
          let vide = true;
          for (const i of indices) {
            if (i === arbre.porteFruit && t >= c.mur) continue; // cette feuille devient le fruit
            const f = arbre.feuilles[i];
            const k = rebond((t - f.debut) / 650);
            if (k <= 0) continue;
            const [x, y] = positionAccroche(poses, arbre, f);
            const px = x + f.vx * s * 60, py = y + f.vy * s * 70, r = f.r * e * k * (1 - s * 0.4);
            ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2);
            vide = false;
          }
          if (!vide) ctx.fill();
        }
      }

      fruitVisible = null;
      if (s > 0) return; // à la sortie, le fruit est porté par la page (EcranReveil)

      // Graine : tombe du ciel au premier arbre ; ensuite, c'est le fruit
      // tombé qui attend au centre, puis se fond dans le tronc qui naît.
      const graine = t < 900 * TEMPO ? (graineAuSol ? 1 : doux(t / (450 * TEMPO))) : Math.max(0, 1 - (t - 900 * TEMPO) / 400);
      if (graine > 0) {
        const y = graineAuSol ? sol - RAYON_FRUIT : sol - RAYON_FRUIT - (1 - doux(t / (700 * TEMPO))) * 60;
        ctx.fillStyle = rgba(accent, 1);
        ctx.beginPath(); ctx.arc(L / 2, y, RAYON_FRUIT * graine, 0, Math.PI * 2); ctx.fill();
      }

      // Fruit : mûrit (grossit, se teinte), tombe, s'écrase, rebondit, roule au centre.
      if (t < c.mur) return;
      anticiper();
      const [fx0, fy0] = positionAccroche(poses, arbre, arbre.feuilles[arbre.porteFruit]);
      let fx = fx0, fy = fy0, sx = 1, sy = 1, rot = 0;
      const maturite = doux((t - c.mur) / (1200 * TEMPO));
      if (t >= c.chute) {
        const [rx, ry] = positionAccroche(repos, arbre, arbre.feuilles[arbre.porteFruit]);
        fx = rx;
        const tc = Math.min(t - c.chute, c.dureeChute) / 1000;
        fy = ry + 0.5 * GRAVITE * tc * tc;
        if (t >= c.sol1) {
          fy = sol - RAYON_FRUIT;
          const ts = t - c.sol1;
          if (ts < 120) { const k = Math.sin((ts / 120) * Math.PI); sx = 1 + 0.28 * k; sy = 1 - 0.28 * k; fy += RAYON_FRUIT * 0.28 * k; }
          else if (t < c.rebondFin) { const k = (t - c.sol1 - 120) / (c.rebondFin - c.sol1 - 120); fy -= Math.sin(k * Math.PI) * 9; }
          if (t >= c.rebondFin) {
            const k = doux((t - c.rebondFin) / (c.roule - c.rebondFin));
            fx = rx + (L / 2 - rx) * k;
            rot = (fx - rx) / RAYON_FRUIT;
          }
        }
      }
      const rayon = RAYON_FRUIT * (0.35 + 0.65 * maturite);
      ctx.save();
      ctx.translate(fx, fy); ctx.scale(sx, sy);
      ctx.fillStyle = rgba(melange(accentClair, accent, maturite), 1);
      ctx.beginPath(); ctx.arc(0, 0, rayon, 0, Math.PI * 2); ctx.fill();
      // Un reflet qui tourne : on voit le fruit rouler.
      ctx.fillStyle = rgba(fond, 0.45 * maturite);
      ctx.beginPath(); ctx.arc(Math.cos(rot - 2.2) * rayon * 0.45, Math.sin(rot - 2.2) * rayon * 0.45, rayon * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (maturite > 0.6) fruitVisible = [fx, fy];
      if (t > c.fin) {
        numero += 1;
        arbre = prochain ?? pousserArbre(numero, L / 2, sol, H, L);
        prochain = null;
        preparer();
        graineAuSol = true;
        // Le fruit vient de se poser : on saute la chute de la graine.
        debut = performance.now() - 350 * TEMPO;
      }
    };

    const positionSortie = () => {
      const rect = canvas.getBoundingClientRect();
      let haut = sol;
      for (const p of poser(arbre, L / 2, sol, () => 0)) haut = Math.min(haut, p.y1);
      const [x, y] = fruitVisible ?? [L / 2, Math.max(16, haut - 10)];
      return { x: rect.left + x, y: rect.top + y };
    };

    // Accéléré de fin : de tDepart à tCible en dureeAcc ms, puis dissolution.
    let acc: { debut: number; tDepart: number; tCible: number; duree: number; fini: (p: { x: number; y: number }) => void } | null = null;
    pilote.current.sortir = () => new Promise((resoudre) => {
      if (calme) { const p = positionSortie(); ctx.clearRect(0, 0, L, H); resoudre(p); return; }
      const c = cache.c;
      // Si le fruit tombe déjà ou que l'arbre s'efface, pas d'accéléré : on part tel quel.
      const tCible = tCourant >= c.chute ? tCourant : Math.max(tCourant, c.mur + 1200 * TEMPO);
      const duree = Math.min(ACCELERE_MAX_MS, (tCible - tCourant) / 5);
      acc = { debut: performance.now(), tDepart: tCourant, tCible, duree, fini: resoudre };
    });

    if (calme) {
      dessiner(arbre.finPousse + 200); // arbre complet, immobile
      return;
    }

    // Boucle à cadence adaptative, mesurée en continu : si une image coûte en
    // moyenne plus de 7 ms (feuillage complet sur un téléphone modeste), on
    // passe à 30 images/s ; on revient à 60 si l'appareil respire à nouveau.
    let anim = 0;
    let derniere = 0;
    let intervalle = 0;
    let coutMoyen = 0;
    const boucle = (maintenant: number) => {
      anim = requestAnimationFrame(boucle);
      if (intervalle && maintenant - derniere < intervalle) return;
      derniere = maintenant;
      const avant = performance.now();
      if (acc) {
        const k = acc.duree > 0 ? Math.min(1, (maintenant - acc.debut) / acc.duree) : 1;
        tCourant = acc.tDepart + (acc.tCible - acc.tDepart) * doux(k);
        dessiner(tCourant);
        if (k >= 1) { const fini = acc.fini; acc = null; sortie = maintenant; fini(positionSortie()); }
      } else if (sortie !== null) {
        dessiner(tCourant, Math.min(1, (maintenant - sortie) / DUREE_SORTIE_MS));
      } else {
        tCourant = maintenant - debut;
        dessiner(tCourant);
      }
      coutMoyen = coutMoyen * 0.9 + (performance.now() - avant) * 0.1;
      if (!intervalle && coutMoyen > 7) intervalle = 33;
      else if (intervalle && coutMoyen < 3) intervalle = 0;
    };
    anim = requestAnimationFrame(boucle);

    // Au retour sur l'onglet, on reprend là où l'on en était.
    const visibilite = () => { if (!document.hidden) debut = performance.now() - tCourant; };
    document.addEventListener('visibilitychange', visibilite);
    const observateur = new ResizeObserver(() => { dimensionner(); prochain = null; arbre = pousserArbre(numero, L / 2, sol, H, L); preparer(); });
    observateur.observe(canvas);

    return () => {
      cancelAnimationFrame(anim);
      document.removeEventListener('visibilitychange', visibilite);
      observateur.disconnect();
    };
  }, []);

  return <canvas ref={toile} className="y-arbre-reveil" aria-hidden="true" />;
});

export default ArbreReveil;
