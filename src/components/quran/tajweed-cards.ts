import { TAJWEED_RULE_BY_INDEX } from "@/constants/tajweed";
import { guideEntryById } from "@/services/guide-content";
import { GuideCategory, GuideEntry, guideTextKey } from "@/types/guide";

export type TajweedCard = { key: string; entry: GuideEntry; title: string; body: string };

// Builds the distinct tajweed-rule cards for an ayah (reading order, deduped),
// shared by the action-sheet row count and the tajweed page. The swatch always
// uses the edition's own colour (this V4 font's palette differs from the guide's);
// the name comes from the mapped Reference-Guide entry, or a generic label for the
// few palette slots without one.
export const buildTajweedCards = (
  tajweed: { index: number; hex: string }[],
  t: (key: string) => string
): TajweedCard[] => {
  const seen = new Set<string>();
  const cards: TajweedCard[] = [];
  for (const { index, hex } of tajweed) {
    const ruleId = TAJWEED_RULE_BY_INDEX[index];
    const entry = ruleId ? guideEntryById(ruleId) : undefined;
    if (entry) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      cards.push({
        key: entry.id,
        entry: { ...entry, color: hex },
        title: t(guideTextKey(entry.id, "title")),
        body: t(guideTextKey(entry.id, "body")),
      });
    } else {
      cards.push({
        key: `idx-${index}`,
        entry: { id: `tajweed.idx-${index}`, category: GuideCategory.TAJWEED, color: hex },
        title: t("quran.tajweed.mark"),
        body: "",
      });
    }
  }
  return cards;
};
