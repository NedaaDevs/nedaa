import { BUNDLED_ORNAMENTS, isDarkPaper } from "@/constants/Quran";
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
