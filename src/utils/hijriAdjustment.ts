import type { TFunction } from "i18next";

/** How many days either way the Hijri date may be moved. */
const HIJRI_OFFSET_LIMIT = 5;

/** Every offset on offer, earliest first. */
export const HIJRI_OFFSETS: readonly number[] = Array.from(
  { length: HIJRI_OFFSET_LIMIT * 2 + 1 },
  (_, index) => index - HIJRI_OFFSET_LIMIT
);

/** An offset as one inflected phrase, so each locale owns its grammar. */
export const hijriAdjustmentLabel = (offset: number, t: TFunction): string => {
  if (offset === 0) return t("settings.hijri.date.adjustments.noAdjustment");
  const count = Math.abs(offset);
  return offset > 0
    ? t("settings.hijri.date.adjustments.plusDays", { count })
    : t("settings.hijri.date.adjustments.minusDays", { count });
};
