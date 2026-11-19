// Moteur de l'arbre de l'écran de réveil — sans React, testable.
//
// Un arbre est une hiérarchie de branches décrites en RELATIF (angle par
// rapport au parent, longueur, courbure) : à chaque image, la position réelle
// est recalculée de la base vers les extrémités, ce qui permet un balancement
// qui plie davantage vers le haut, avec un léger retard d'une génération à
// l'autre (comme une onde qui monte dans l'arbre).

export interface Branche {
  parent: number;         // -1 pour le tronc
  prof: number;           // 0 = tronc
  angle: number;          // angle relatif au parent (radians)
  long: number;
  courbure: number;       // déviation du point de contrôle (radians)
  epDebut: number;        // épaisseur à la naissance = épaisseur de fin du parent
  epFin: number;
  debut: number;          // ms depuis le début de la pousse
  duree: number;
  pression: number;       // irrégularité du trait de plume
}

export interface Feuille { branche: number; dx: number; dy: number; r: number; alpha: number; clair: boolean; debut: number; vx: number; vy: number }
export interface Tache { branche: number; dx: number; dy: number; r: number; alpha: number; debut: number }

export interface Arbre {
  branches: Branche[];
  feuilles: Feuille[];
  taches: Tache[];
  porteFruit: number;     // index de la feuille qui portera le fruit
  echelle: number;        // réduction pour tenir dans la toile
  finPousse: number;      // ms : feuillage complet
}

export interface Pose { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; a: number }

export const PROFONDEUR_MAX = 5;

export function generateur(graine: number) {
  let s = (Math.abs(Math.floor(graine)) * 9301 + 49297) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Le « port » d'un arbre : sa façon de pousser. Il varie d'un arbre à
// l'autre (plus ou moins ouvert, plus ou moins élancé) pour que deux arbres
// successifs ne se ressemblent pas.
export interface Port { ouverture: number; decroissance: number; tronc: number; penchant: number; densite: number }

export function portDeGraine(graine: number): Port {
  const r = generateur(graine * 97 + 3);
  return { ouverture: 0.08 + r() * 0.32, decroissance: 0.66 + r() * 0.13, tronc: 0.2 + r() * 0.12, penchant: (r() - 0.5) * 0.14, densite: 0.6 + r() * 0.7 };
}

function construire(graine: number, hauteur: number, port: Port): Arbre {
  const r = generateur(graine);
  const branches: Branche[] = [];
  const feuilles: Feuille[] = [];
  const taches: Tache[] = [];

  const pousser = (parent: number, prof: number, angle: number, long: number, epDebut: number, debut: number) => {
    const id = branches.length;
    const epFin = epDebut * (prof === 0 ? 0.62 : 0.66);
    const duree = 380 + long * 9;
    branches.push({ parent, prof, angle, long, courbure: (r() - 0.5) * 0.45, epDebut, epFin, debut, duree, pression: 0.88 + r() * 0.24 });
    const fin = debut + duree * 0.85;
    if (prof >= PROFONDEUR_MAX || long < 9) {
      const n = Math.max(1, Math.round((2 + r() * 3) * port.densite));
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 14;
        feuilles.push({ branche: id, dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, r: 2.2 + r() * 4, alpha: 0.28 + r() * 0.66, clair: r() < 0.35, debut: fin, vx: (r() - 0.5) * 0.6, vy: -0.4 - r() * 0.8 });
      }
      if (r() < 0.5) taches.push({ branche: id, dx: (r() - 0.5) * 12, dy: (r() - 0.5) * 10, r: 10 + r() * 12, alpha: 0.05 + r() * 0.04, debut: fin - 200 + r() * 600 });
      return;
    }
    // Les branches montent : l'écart s'ouvre un peu moins près du sommet.
    const enfants = prof < 1 ? 2 : r() < 0.3 ? 3 : 2;
    for (let i = 0; i < enfants; i++) {
      const cote = i % 2 ? 1 : -1;
      const ecart = (port.ouverture + r() * 0.34) * cote + (r() - 0.5) * 0.22 + port.penchant;
      pousser(id, prof + 1, ecart, long * (port.decroissance + r() * 0.12), epFin, fin + r() * 120);
    }
  };
  pousser(-1, 0, (r() - 0.5) * 0.1, hauteur * port.tronc, 7, 700);
  return { branches, feuilles, taches, porteFruit: 0, echelle: 1, finPousse: 0 };
}

/** Positions de toutes les branches pour un balancement donné. */
export function poser(arbre: Arbre, baseX: number, baseY: number, vent: (prof: number) => number): Pose[] {
  const poses: Pose[] = [];
  const e = arbre.echelle;
  for (const b of arbre.branches) {
    const p = b.parent >= 0 ? poses[b.parent] : null;
    const a = (p ? p.a : -Math.PI / 2) + b.angle + vent(b.prof);
    const x0 = p ? p.x1 : baseX;
    const y0 = p ? p.y1 : baseY;
    const L = b.long * e;
    const x1 = x0 + Math.cos(a) * L;
    const y1 = y0 + Math.sin(a) * L;
    const cx = x0 + Math.cos(a + b.courbure) * L * 0.5;
    const cy = y0 + Math.sin(a + b.courbure) * L * 0.5;
    poses.push({ x0, y0, cx, cy, x1, y1, a });
  }
  return poses;
}

export function surCourbe(p: Pose, k: number): [number, number] {
  const u = 1 - k;
  return [u * u * p.x0 + 2 * u * k * p.cx + k * k * p.x1, u * u * p.y0 + 2 * u * k * p.cy + k * k * p.y1];
}

/** Position d'une feuille (ou d'une tache) accrochée au bout de sa branche. */
export function positionAccroche(poses: Pose[], arbre: Arbre, a: { branche: number; dx: number; dy: number }): [number, number] {
  const p = poses[a.branche];
  const e = arbre.echelle;
  return [p.x1 + a.dx * e, p.y1 + a.dy * e];
}

function boite(arbre: Arbre, baseX: number, baseY: number) {
  const poses = poser(arbre, baseX, baseY, () => 0);
  let minX = baseX, maxX = baseX, minY = baseY;
  for (const p of poses) { minX = Math.min(minX, p.x1, p.cx); maxX = Math.max(maxX, p.x1, p.cx); minY = Math.min(minY, p.y1, p.cy); }
  for (const f of arbre.feuilles) {
    const [x, y] = positionAccroche(poses, arbre, f);
    const r = f.r * arbre.echelle;
    minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minY = Math.min(minY, y - r);
  }
  return { minX, maxX, minY };
}

/**
 * Qualité d'une silhouette : une couronne plutôt large que haute, centrée sur
 * le tronc, sans côté vide. 0 = ratée, 1 = idéale.
 */
export function noteSilhouette(arbre: Arbre, baseX: number, baseY: number, ratioVise = 1.2): number {
  const { minX, maxX, minY } = boite(arbre, baseX, baseY);
  const largeur = maxX - minX;
  const hauteur = baseY - minY;
  const ratio = largeur / Math.max(1, hauteur);
  const noteRatio = Math.max(0, 1 - Math.abs(ratio - ratioVise) / 0.8);
  const gauche = baseX - minX;
  const droite = maxX - baseX;
  const equilibre = Math.min(gauche, droite) / Math.max(1, Math.max(gauche, droite));
  return noteRatio * 0.5 + equilibre * 0.5;
}

/**
 * Pousse l'arbre « numéro graine » : essaie quelques variantes et garde la
 * plus belle silhouette, puis le réduit pour qu'il tienne dans la toile.
 * Ordonne aussi l'éclosion du feuillage du cœur vers l'extérieur.
 */
export function pousserArbre(graine: number, baseX: number, baseY: number, hauteur: number, largeurToile: number): Arbre {
  let meilleur: Arbre | null = null;
  let meilleureNote = -1;
  // Chaque arbre vise sa propre silhouette — tantôt ronde, tantôt étalée
  // comme un acacia — pour que deux arbres successifs ne se ressemblent pas.
  const port = portDeGraine(graine);
  const ratioVise = 0.95 + generateur(graine * 53 + 11)() * 0.55;
  for (let essai = 0; essai < 6; essai++) {
    const candidat = construire(graine * 7 + essai * 1013, hauteur, port);
    const note = noteSilhouette(candidat, baseX, baseY, ratioVise);
    if (note > meilleureNote) { meilleur = candidat; meilleureNote = note; }
    if (note > 0.78) break;
  }
  const arbre = meilleur!;

  const marge = 14;
  const { minX, maxX, minY } = boite(arbre, baseX, baseY);
  arbre.echelle = Math.min(1,
    (baseX - marge) / Math.max(1, baseX - minX),
    (largeurToile - baseX - marge) / Math.max(1, maxX - baseX),
    (baseY - marge) / Math.max(1, baseY - minY));

  // Éclosion du cœur vers l'extérieur, en grappes.
  const poses = poser(arbre, baseX, baseY, () => 0);
  const coeur = boite(arbre, baseX, baseY);
  const cx = baseX;
  const cy = coeur.minY + (baseY - coeur.minY) * 0.35;
  const finBranches = Math.max(...arbre.branches.map((b) => b.debut + b.duree));
  const r = generateur(graine * 31 + 7);
  let dMax = 1;
  const distances = arbre.feuilles.map((f) => {
    const [x, y] = positionAccroche(poses, arbre, f);
    const d = Math.hypot(x - cx, y - cy);
    dMax = Math.max(dMax, d);
    return d;
  });
  arbre.feuilles.forEach((f, i) => {
    const pousseBranche = arbre.branches[f.branche].debut + arbre.branches[f.branche].duree * 0.85;
    f.debut = Math.max(pousseBranche, finBranches - 900) + (distances[i] / dMax) * 900 + r() * 220;
  });
  arbre.finPousse = Math.max(...arbre.feuilles.map((f) => f.debut + 650));

  // Le fruit naît d'une feuille bien visible du haut de la couronne.
  let porteur = 0;
  let plusHaut = Infinity;
  arbre.feuilles.forEach((f, i) => {
    const [, y] = positionAccroche(poses, arbre, f);
    const score = y + (f.alpha < 0.5 ? 1000 : 0) + r() * 40;
    if (score < plusHaut) { plusHaut = score; porteur = i; }
  });
  arbre.porteFruit = porteur;
  return arbre;
}

// Courbes de temps
export const doux = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
export const rebond = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
