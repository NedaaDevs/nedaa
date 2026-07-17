import { BUNDLED_ORNAMENTS, isDarkPaper, OrnamentPackMeta } from "@/constants/Quran";
import { OrnamentAsset, OrnamentCategory, OrnamentSlot, QuranThemeType } from "@/enums/quran";

// 5 reader themes → 2 pre-tinted slots. Light papers read the sepia (dark-ink)
// artwork; dark papers read the dark (light-ink) artwork. Generalizes the old
// per-theme QURAN_MARKER_FRAME map to every ornament category.
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
