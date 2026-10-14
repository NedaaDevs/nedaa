import { useTranslation } from "react-i18next";

import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkySwatch } from "@/components/ui/sky-preview";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import type { AppMode } from "@/enums/app";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useHaptic } from "@/hooks/useHaptic";
import { skySwatchFor } from "@/utils/sky";

/** The appearance modes, each with its sky; a choice applies at once. */
export const AppearanceChoices = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const chooseMode = useChooseMode();
  const sky = usePageSky();

  const choose = (mode: AppMode) => {
    hapticSelection();
    void chooseMode(mode);
  };

  return (
    <ChoiceGroup label={t("settings.appearance")}>
      {APPEARANCE_ORDER.map((mode) => (
        <ChoiceRow
          key={mode}
          title={t(`settings.themes.${mode}.title`)}
          subtitle={t(`settings.themes.${mode}.description`)}
          selected={sky.mode === mode}
          onPress={() => choose(mode)}
          leading={
            <SkySwatch bands={skySwatchFor(mode)} hijriDay={sky.hijriDay} isRTL={sky.isRTL} />
          }
        />
      ))}
    </ChoiceGroup>
  );
};
