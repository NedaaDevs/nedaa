import { Paths } from "expo-file-system";

import {
  BUNDLED_ORNAMENTS,
  isDarkPaper,
  NEDAA_STYLE_ID,
  OrnamentPackMeta,
} from "@/constants/Quran";
import {
  MushafVersion,
  OrnamentAsset,
  OrnamentCategory,
  OrnamentSlot,
  QuranThemeType,
} from "@/enums/quran";

// 5 reader themes → 2 pre-tinted slots. Light papers read the sepia (dark-ink)
// artwork; dark papers read the dark (light-ink) artwork — one mapping for
// every ornament category.
export const ornamentThemeSlot = (theme: QuranThemeType): OrnamentSlot =>
  isDarkPaper(theme) ? OrnamentSlot.DARK : OrnamentSlot.SEPIA;

// Bundled nedaa art lookup — undefined when a category doesn't carry the asset.
export const bundledOrnamentModule = (
  category: OrnamentCategory,
  asset: OrnamentAsset,
  slot: OrnamentSlot
): number | undefined => BUNDLED_ORNAMENTS[category][asset]?.[slot];

// Pack files are named `<asset>-<slot>.png`, matching pack.json's asset keys.
export const ornamentSlotFileName = (asset: OrnamentAsset, slot: OrnamentSlot): string =>
  `${asset}-${slot}.png`;

// The style a renderer should draw for a category + edition:
// user choice → manifest-resolved (written at pack install) → bundled nedaa.
export const effectiveOrnamentStyle = (
  userChoice: string | undefined,
  resolved: string | undefined
): string => userChoice ?? resolved ?? NEDAA_STYLE_ID;

// Render-time image source for a category's asset: the installed pack's doc-dir
// file for a non-nedaa style, else the bundled nedaa module. A missing doc-dir
// file renders as nothing (ornaments are decorative; ensureOrnamentsInstalled
// re-fetches on next open).
export const resolveOrnamentImage = (
  category: OrnamentCategory,
  asset: OrnamentAsset,
  theme: QuranThemeType,
  version: MushafVersion,
  styleId: string
): { uri: string } | number => {
  const slot = ornamentThemeSlot(theme);
  const file = ornamentSlotFileName(asset, slot);
  if (styleId !== NEDAA_STYLE_ID) {
    return { uri: `${Paths.document.uri}quran/${version}/ornaments/${category}/${file}` };
  }
  return bundledOrnamentModule(category, asset, slot) ?? 0;
};

// Marker box over the squarish glyph slot: height-based, width from the art's
// native aspect (portrait medallions overhang the slot vertically) — never
// stretched to the slot's own proportions.
export const medallionBox = (
  slotWidth: number,
  slotHeight: number,
  aspect: number,
  scaleMultiplier: number
): { width: number; height: number } => {
  const height = slotHeight * scaleMultiplier;
  return { width: height * aspect, height };
};

// Parse a pack.json blob into OrnamentPackMeta, or null when malformed/incomplete
// (caller keeps the bundled meta). Guards the two required fields.
export const parseOrnamentPackJson = (raw: string): OrnamentPackMeta | null => {
  try {
    const obj = JSON.parse(raw) as Partial<OrnamentPackMeta>;
    if (typeof obj.version !== "string" || !obj.assets || typeof obj.assets !== "object") {
      return null;
    }
    return obj as OrnamentPackMeta;
  } catch {
    return null;
  }
};
