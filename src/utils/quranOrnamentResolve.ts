import { NEDAA_STYLE_ID } from "@/constants/Quran";
import { OrnamentCategory } from "@/enums/quran";
import type { QuranManifest, QuranOrnamentGroup, QuranOrnamentOption } from "@/types/quran";

// user choice → defaultByEdition → group default → bundled nedaa.
export const resolveOrnamentStyle = (
  category: OrnamentCategory,
  edition: string,
  manifest: QuranManifest | null,
  userChoice?: string
): string => {
  const group = manifest?.ornaments?.[category];
  if (!group) return userChoice ?? NEDAA_STYLE_ID;
  return userChoice ?? group.defaultByEdition?.[edition] ?? group.default ?? NEDAA_STYLE_ID;
};

// The option backing a resolved style id for an edition: by explicit id, else the
// first option scoped to this edition.
export const findOrnamentOption = (
  group: QuranOrnamentGroup | undefined,
  styleId: string,
  edition: string
): QuranOrnamentOption | undefined => {
  if (!group) return undefined;
  return (
    group.options.find((o) => o.id === styleId) ??
    group.options.find((o) => o.editions?.includes(edition))
  );
};
