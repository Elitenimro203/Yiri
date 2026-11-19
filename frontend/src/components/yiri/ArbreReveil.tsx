import { useEffect, useRef } from 'react';

// Arbre de l'écran d'attente : une graine tombe, un arbre pousse (branches à
// l'encre, léger lavis, feuillage de points), un fruit mûrit, tombe, roule au
// centre et devient la graine de l'arbre suivant. Chaque arbre est différent.
//
// Purement symbolique (vision §17, §30) : il ne reflète AUCUNE donnée de la
// personne, rien ne se mérite ni ne se perd. Couleurs lues dans le thème
// (encre, accent, ligne). Pensé pour les téléphones modestes : feuillage
// limité, 30 images/s au plus, pause quand l'onglet est caché, arbre immobile
// si l'appareil demande moins d'animations.

type Rgb = [number, number, number];

interface Segment { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; ep: number; debut: number; duree: number; decal: number }
interface Point { x: number; y: number; r: number; alpha: number; debut: number }
interface Tache { x: number; y: number; r: number; alpha: number; debut: number }
interface Arbre { segments: Segment[]; points: Point[]; taches: Tache[]; fruit: { x: number; y: number } }

const PROFONDEUR_MAX = 5;
const MUR_MS = 5600;
const CHUTE_MS = 7000;
const FIN_MS = 9400;
const IMAGE_MIN_MS = 1000 / 30;

function hexVersRgb(valeur: string, defaut: Rgb): Rgb {
  const h = valeur.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return defaut;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function generateur(graine: number) {
  let s = (graine * 9301 + 49297) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const doux = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
const rebond = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));

function pousser(graine: number, cx: number, sol: number, hauteur: number, largeur: number): Arbre {
  const r = generateur(graine);
  const segments: Segment[] = [];
  const points: Point[] = [];
  const taches: Tache[] = [];
  const branche = (x0: number, y0: number, angle: number, long: number, ep: number, prof: number, debut: number) => {
    const x1 = x0 + Math.cos(angle) * long;
    const y1 = y0 + Math.sin(angle) * long;
    const duree = 420 + long * 9;
    segments.push({
      x0, y0, x1, y1, ep, debut, duree, decal: (r() - 0.5) * 1.8,
      cx: x0 + Math.cos(angle + (r() - 0.5) * 0.5) * long * 0.5,
      cy: y0 + Math.sin(angle + (r() - 0.5) * 0.5) * long * 0.5,
    });
    const fin = debut + duree * 0.85;
    if (prof >= PROFONDEUR_MAX || long < 9) {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 15;
        points.push({ x: x1 + Math.cos(a) * d, y: y1 + Math.sin(a) * d * 0.8, r: 2.4 + r() * 4, alpha: 0.22 + r() * 0.7, debut: fin + r() * 700 });
      }
      if (r() < 0.5) taches.push({ x: x1 + (r() - 0.5) * 12, y: y1 + (r() - 0.5) * 10, r: 10 + r() * 12, alpha: 0.05 + r() * 0.04, debut: fin - 200 + r() * 600 });
      return;
    }
    const enfants = prof < 1 ? 2 : r() < 0.3 ? 3 : 2;
    for (let i = 0; i < enfants; i++) {
      branche(x1, y1, angle + (0.32 + r() * 0.38) * (i % 2 ? 1 : -1) + (r() - 0.5) * 0.25, long * (0.7 + r() * 0.14), ep * 0.66, prof + 1, fin + r() * 120);
    }
  };
  branche(cx, sol, -Math.PI / 2 + (r() - 0.5) * 0.12, hauteur * 0.27, 6, 0, 700);
  // Chaque arbre tient dans la toile : on le réduit autour de sa base si sa
  // couronne déborderait (jamais agrandi, pour garder une taille stable).
  const marge = 14;
  let minX = cx, maxX = cx, minY = sol;
  for (const g of segments) { minX = Math.min(minX, g.x1, g.cx); maxX = Math.max(maxX, g.x1, g.cx); minY = Math.min(minY, g.y1, g.cy); }
  for (const p of points) { minX = Math.min(minX, p.x - p.r); maxX = Math.max(maxX, p.x + p.r); minY = Math.min(minY, p.y - p.r); }
  const echelle = Math.min(1, (cx - marge) / Math.max(1, cx - minX), (largeur - cx - marge) / Math.max(1, maxX - cx), (sol - marge) / Math.max(1, sol - minY));
  if (echelle < 1) {
    const ech = (x: number, y: number): [number, number] => [cx + (x - cx) * echelle, sol + (y - sol) * echelle];
    for (const g of segments) {
      [g.x0, g.y0] = ech(g.x0, g.y0); [g.cx, g.cy] = ech(g.cx, g.cy); [g.x1, g.y1] = ech(g.x1, g.y1); g.ep *= Math.max(0.75, echelle);
    }
    for (const p of points) { [p.x, p.y] = ech(p.x, p.y); p.r *= Math.max(0.8, echelle); }
    for (const q of taches) { [q.x, q.y] = ech(q.x, q.y); q.r *= echelle; }
  }
  const visibles = points.filter((p) => p.alpha > 0.5);
  const porteur = visibles[Math.floor(r() * visibles.length)] ?? points[0] ?? { x: cx, y: sol - 80 };
  return { segments, points, taches, fruit: { x: porteur.x, y: porteur.y } };
}

function pointCourbe(s: Segment, k: number): [number, number] {
  const u = 1 - k;
  return [u * u * s.x0 + 2 * u * k * s.cx + k * k * s.x1, u * u * s.y0 + 2 * u * k * s.cy + k * k * s.y1];
}

export default function ArbreReveil() {
  const toile = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = toile.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(canvas);
    const encre = hexVersRgb(styles.getPropertyValue('--y-ink'), [17, 18, 20]);
    const accent = hexVersRgb(styles.getPropertyValue('--y-accent'), [35, 70, 184]);
    const ligne = hexVersRgb(styles.getPropertyValue('--y-line'), [230, 231, 234]);
    // Sur fond sombre, le lavis se voit davantage : on l'allège.
    const lumineux = (encre[0] + encre[1] + encre[2]) / 3 > 128;
    const forceLavis = lumineux ? 0.55 : 1;
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let L = 0, H = 0, sol = 0;
    const dimensionner = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      L = canvas.clientWidth; H = canvas.clientHeight; sol = H - 28;
      canvas.width = Math.round(L * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    dimensionner();

    let graine = 7;
    let arbre = pousser(graine, L / 2, sol, H, L);
    let debut = performance.now();
    let derniere = 0;
    let anim = 0;

    const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    const dessiner = (t: number) => {
      ctx.clearRect(0, 0, L, H);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(ligne, 1); ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L / 2 - 90, sol); ctx.lineTo(L / 2 + 90, sol); ctx.stroke();

      const fondu = t > CHUTE_MS + 500 ? Math.max(0, 1 - (t - CHUTE_MS - 500) / 1000) : 1;
      const balance = Math.sin(t / 1600) * 0.012 * doux((t - 4400) / 1500);
      ctx.save();
      ctx.translate(L / 2, sol); ctx.rotate(balance); ctx.translate(-L / 2, -sol);

      for (const q of arbre.taches) {
        const k = doux((t - q.debut) / 1800);
        if (k <= 0) continue;
        ctx.fillStyle = rgba(accent, q.alpha * forceLavis * fondu);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(q.x + i, q.y - i * 0.7, q.r * k * (1 - i * 0.15), 0, Math.PI * 2); ctx.fill(); }
      }
      for (const s of arbre.segments) {
        const k = doux((t - s.debut) / s.duree);
        if (k <= 0) continue;
        for (const [decal, largeur, alpha] of [[s.decal, Math.max(0.8, s.ep * 1.6), 0.1 * forceLavis], [0, Math.max(0.6, s.ep), 0.9]] as const) {
          ctx.strokeStyle = rgba(encre, alpha * fondu); ctx.lineWidth = largeur;
          ctx.beginPath(); ctx.moveTo(s.x0 + decal, s.y0);
          for (let i = 1; i <= 10 * k; i++) { const p = pointCourbe(s, i / 10); ctx.lineTo(p[0] + decal, p[1]); }
          const p = pointCourbe(s, k); ctx.lineTo(p[0] + decal, p[1]); ctx.stroke();
        }
      }
      for (const q of arbre.points) {
        const k = rebond((t - q.debut) / 650);
        if (k <= 0) continue;
        ctx.fillStyle = rgba(accent, q.alpha * fondu);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // La graine tombe, puis se fond dans le tronc.
      const graineVisible = t < 900 ? doux(t / 500) : Math.max(0, 1 - (t - 900) / 400);
      if (graineVisible > 0) {
        ctx.fillStyle = rgba(accent, 1);
        ctx.beginPath(); ctx.arc(L / 2, sol - 6 - (1 - doux(t / 700)) * 60, 6 * graineVisible, 0, Math.PI * 2); ctx.fill();
      }
      // Le fruit mûrit, tombe, roule jusqu'au centre : la graine du suivant.
      const mur = rebond((t - MUR_MS) / 700);
      if (mur > 0) {
        let fx = arbre.fruit.x, fy = arbre.fruit.y;
        const c = (t - CHUTE_MS) / 1000;
        if (c > 0) {
          const k = Math.min(1, c);
          fy = arbre.fruit.y + (sol - 6 - arbre.fruit.y) * k * k;
          if (c > 1) fx = arbre.fruit.x + (L / 2 - arbre.fruit.x) * doux((c - 1) / 1.2);
        }
        ctx.fillStyle = rgba(accent, 1);
        ctx.beginPath(); ctx.arc(fx, fy, 6.5 * Math.min(1, mur), 0, Math.PI * 2); ctx.fill();
      }
    };

    if (calme) {
      // Un arbre déjà poussé, feuillage complet, immobile.
      const complet = Math.max(...arbre.points.map((p) => p.debut + 700), ...arbre.taches.map((q) => q.debut + 1800), MUR_MS + 800);
      dessiner(Math.min(complet, CHUTE_MS + 400));
      return;
    }

    const boucle = (maintenant: number) => {
      anim = requestAnimationFrame(boucle);
      if (maintenant - derniere < IMAGE_MIN_MS) return;
      derniere = maintenant;
      let t = maintenant - debut;
      if (t > FIN_MS) {
        graine += 1;
        arbre = pousser(graine, L / 2, sol, H, L);
        debut = maintenant; t = 0;
      }
      dessiner(t);
    };
    anim = requestAnimationFrame(boucle);

    // requestAnimationFrame se met déjà en pause dans un onglet caché ; au
    // retour, on repart d'un arbre neuf plutôt que d'un saut dans le temps.
    const visibilite = () => { if (!document.hidden) { debut = performance.now(); } };
    document.addEventListener('visibilitychange', visibilite);
    const observateur = new ResizeObserver(() => { dimensionner(); arbre = pousser(graine, L / 2, sol, H, L); });
    observateur.observe(canvas);

    return () => {
      cancelAnimationFrame(anim);
      document.removeEventListener('visibilitychange', visibilite);
      observateur.disconnect();
    };
  }, []);

  return <canvas ref={toile} className="y-arbre-reveil" aria-hidden="true" />;
}
