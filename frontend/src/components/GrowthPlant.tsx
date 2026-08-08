export interface Stage {
  seuil: number;
  nom: string;
  branches: number;
  hauteur: number;
}

// Mêmes seuils que le prototype tracker-culture.html déjà testé avec Kouadio —
// à recalibrer ensemble une fois quelques semaines d'usage réel observées.
export const STAGES: Stage[] = [
  { seuil: 0, nom: 'Graine', branches: 0, hauteur: 30 },
  { seuil: 15, nom: 'Pousse', branches: 1, hauteur: 55 },
  { seuil: 40, nom: 'Jeune arbre', branches: 2, hauteur: 85 },
  { seuil: 90, nom: 'Arbre', branches: 3, hauteur: 115 },
  { seuil: 180, nom: 'Arbre porteur de fruits', branches: 4, hauteur: 135 },
];

export function stadeActuel(lifetimeCoches: number): { stage: Stage; index: number; suivant: Stage | null } {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (lifetimeCoches >= STAGES[i].seuil) idx = i;
  }
  return { stage: STAGES[idx], index: idx, suivant: STAGES[idx + 1] ?? null };
}

interface GrowthPlantProps {
  /** Total de cases cochées depuis le tout début — ne redescend jamais */
  lifetimeCoches: number;
  /** Cases cochées cette semaine, pour les feuilles transitoires */
  cocheesSemaine: number;
  possiblesSemaine: number;
  size?: number;
}

export default function GrowthPlant({ lifetimeCoches, cocheesSemaine, possiblesSemaine, size = 200 }: GrowthPlantProps) {
  const { stage, index: stageIdx } = stadeActuel(lifetimeCoches);
  const pct = possiblesSemaine > 0 ? cocheesSemaine / possiblesSemaine : 0;

  const baseY = 175;
  const topY = baseY - stage.hauteur;

  const branchPoints: { x: number; y: number }[] = [];
  let branches = '';
  for (let b = 0; b < stage.branches; b++) {
    const t = (b + 1) / (stage.branches + 1);
    const y = baseY - t * stage.hauteur * 0.85;
    const side = b % 2 === 0 ? 1 : -1;
    const len = 22 + t * 14;
    const endX = 100 + side * len;
    const endY = y - len * 0.35;
    branches += `<path d="M100 ${y} Q ${100 + side * len * 0.5} ${y - 6} ${endX} ${endY}" stroke="#5A6B4A" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    branchPoints.push({ x: endX, y: endY });
  }
  branchPoints.push({ x: 100, y: topY });

  let leaves = '';
  const leafCount = Math.min(cocheesSemaine, 18);
  for (let i = 0; i < leafCount; i++) {
    const point = branchPoints[i % branchPoints.length];
    const jitterX = ((i * 37) % 20) - 10;
    const jitterY = ((i * 53) % 14) - 7;
    const t = (i + 1) / (leafCount + 1);
    const color = t > 0.75 ? '#E8B04B' : t > 0.45 ? '#9DBE5E' : '#7FB069';
    leaves += `<ellipse cx="${point.x + jitterX}" cy="${point.y + jitterY}" rx="9" ry="5" transform="rotate(${(i * 47) % 360} ${point.x + jitterX} ${point.y + jitterY})" fill="${color}" opacity="0.92"/>`;
  }

  const bloom =
    pct >= 0.85
      ? `<circle cx="100" cy="${topY - 6}" r="7" fill="#E8B04B"/><circle cx="100" cy="${topY - 6}" r="3" fill="#FFF6E0"/>`
      : '';

  const svg = `
    <svg width="${size}" height="${size * 0.95}" viewBox="0 0 200 190">
      <ellipse cx="100" cy="180" rx="${30 + stageIdx * 6}" ry="7" fill="#0D120B"/>
      <path d="M100 ${baseY} Q ${100 + Math.sin(pct * 2) * 4} ${topY + (baseY - topY) / 2} 100 ${topY}"
        stroke="#5A6B4A" stroke-width="${4 + stageIdx}" fill="none" stroke-linecap="round"/>
      ${branches}
      ${leaves}
      ${bloom}
    </svg>`;

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
