import type { TFunction } from "i18next";
import type { ColorSchemeName } from "react-native";

import { PHASE, type Phase } from "@/constants/Phase";
import { PRAYER_ID } from "@/constants/Prayer";
import { AppMode } from "@/enums/app";
import { isDarkMode } from "@/utils/appearance";

/** A phase that begins at a prayer goes by the prayer's name. */
const PHASE_NAME = {
  [PHASE.DAWN]: `prayerTimes.${PRAYER_ID.FAJR}`,
  [PHASE.DAY]: `settings.themes.phases.${PHASE.DAY}.name`,
  [PHASE.ASR]: `prayerTimes.${PRAYER_ID.ASR}`,
  [PHASE.MAGHRIB]: `prayerTimes.${PRAYER_ID.MAGHRIB}`,
  [PHASE.NIGHT]: `settings.themes.phases.${PHASE.NIGHT}.name`,
} as const satisfies Record<Phase, string>;

const titleOf = (phase: Phase) => `settings.themes.phases.${phase}.title` as const;
const noteOf = (phase: Phase) => `settings.themes.phases.${phase}.note` as const;

export type AppearancePreview = { kicker: string; title: string; note: string };

/** The Appearance hero's three lines: the mode, how it looks now, and why. */
export const appearancePreview = (
  t: TFunction,
  mode: AppMode,
  systemScheme: ColorSchemeName | null | undefined,
  phase: Phase | undefined
): AppearancePreview => {
  const dark = isDarkMode(mode, systemScheme, phase);
  // Without a phase, the day or the night that the brightness reads as.
  const plainTitle = titleOf(dark ? PHASE.NIGHT : PHASE.DAY);

  switch (mode) {
    case AppMode.ADAPTIVE:
      return phase
        ? {
            kicker: t("settings.themes.preview.adaptive", { phase: t(PHASE_NAME[phase]) }),
            title: t(titleOf(phase)),
            note: t(noteOf(phase)),
          }
        : {
            kicker: t("settings.themes.preview.adaptivePending"),
            title: t(plainTitle),
            note: t("settings.themes.preview.adaptivePendingNote"),
          };
    case AppMode.SYSTEM:
      return {
        kicker: t("settings.themes.preview.system", {
          look: t(dark ? "settings.themes.dark.title" : "settings.themes.light.title"),
        }),
        title: t(plainTitle),
        note: t("settings.themes.preview.systemNote"),
      };
    case AppMode.LIGHT:
      return {
        kicker: t("settings.themes.preview.light"),
        title: t(plainTitle),
        note: t("settings.themes.preview.lightNote"),
      };
    case AppMode.DARK:
      return {
        kicker: t("settings.themes.preview.dark"),
        title: t(plainTitle),
        note: t("settings.themes.preview.darkNote"),
      };
  }
};
