// Icônes au trait du design system : 22px, épaisseur 1,6, bouts arrondis,
// une seule couleur (currentColor). Toujours décoratives : le bouton qui les
// porte a son propre libellé accessible.

const CHEMINS = {
  plus: <path d="M11 5v12M5 11h12" />,
  reglages: (
    <>
      <circle cx="11" cy="11" r="2.5" />
      <path d="M11 3.5v2M11 16.5v2M3.5 11h2M16.5 11h2M5.7 5.7l1.4 1.4M14.9 14.9l1.4 1.4M5.7 16.3l1.4-1.4M14.9 7.1l1.4-1.4" />
    </>
  ),
  fermer: <path d="M6 6l10 10M16 6L6 16" />,
  aujourdhui: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M11 6.5v4.5l3 2" />
    </>
  ),
  constructions: <path d="M4 18V9M10 18V5M16 18v-6" />,
  trajectoire: (
    <>
      <path d="M4 17c3-1 4-9 7-9s4 6 7 5" />
      <circle cx="4" cy="17" r="1.2" />
      <circle cx="18" cy="13" r="1.2" />
    </>
  ),
  reflexions: <path d="M5 5h12v9H9l-4 3z" />,
  rappels: <path d="M6 15V10a5 5 0 0 1 10 0v5l1.5 2h-13L6 15zM9.5 19a1.8 1.8 0 0 0 3 0" />,
  sortir: <path d="M9 4H5v14h4M13 7l4 4-4 4M17 11H8" />,
} as const;

export type NomIcone = keyof typeof CHEMINS;

export default function Icone({ nom, taille = 22 }: { nom: NomIcone; taille?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={taille}
      height={taille}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CHEMINS[nom]}
    </svg>
  );
}
