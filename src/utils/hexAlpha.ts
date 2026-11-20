/** A `#RRGGBB` colour at an alpha, as `#RRGGBBAA`; an alpha it has is replaced. */
export const hexAlpha = (hex: string, alpha: number): string =>
  `${hex.slice(0, 7)}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
