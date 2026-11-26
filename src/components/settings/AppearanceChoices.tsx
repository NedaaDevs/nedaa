import { useTranslation } from "react-i18next";

import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkySwatch } from "@/components/ui/sky-preview";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import type { AppMode } from "@/enums/app";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useDayRun } from "@/contexts/DayRunContext";
import { skySwatchFor } from "@/utils/sky";

type Props = {
  /** The mode to mark as the user's own while it stays the choice. */
  currentMark?: AppMode;
};

/** The appearance modes, each with its sky; a choice applies at once. */
export const AppearanceChoices = ({ currentMark }: Props) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const chooseMode = useChooseMode();
  // Only what the rows read, so a run's tick leaves the rows as they are.
  const { mode: chosen, hijriDay, isRTL } = usePageSky();
  const endRun = useDayRun()?.end;

  const choose = (mode: AppMode) => {
    hapticSelection();
    // A run ends first, so the chosen look replaces the one it draws.
    endRun?.();
    void chooseMode(mode);
  };

  return (
    <ChoiceGroup label={t("settings.appearance")}>
      {APPEARANCE_ORDER.map((mode) => (
        <ChoiceRow
          key={mode}
          title={t(`settings.themes.${mode}.title`)}
          subtitle={t(`settings.themes.${mode}.description`)}
          selected={chosen === mode}
          badge={
            chosen === mode && mode === currentMark
              ? t("onboarding.upgrade.currentSetting")
              : undefined
          }
          onPress={() => choose(mode)}
          leading={<SkySwatch bands={skySwatchFor(mode)} hijriDay={hijriDay} isRTL={isRTL} />}
        />
      ))}
    </ChoiceGroup>
  );
};
