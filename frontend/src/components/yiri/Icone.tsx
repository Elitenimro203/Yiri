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
