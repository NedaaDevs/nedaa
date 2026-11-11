import { useTranslation } from "react-i18next";

import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { TODAY_STYLE } from "@/constants/Today";
import { usePreferencesStore } from "@/stores/preferences";

const TODAY_STYLES = Object.values(TODAY_STYLE);

/** The Today styles; a choice applies at once. */
export const TodayStyleChoices = () => {
  const { t } = useTranslation();
  const todayStyle = usePreferencesStore((state) => state.todayStyle);
  const setTodayStyle = usePreferencesStore((state) => state.setTodayStyle);

  return (
    <SegmentedChoice
      options={TODAY_STYLES}
      value={todayStyle}
      onChange={setTodayStyle}
      accessibilityLabel={t("settings.preferences.todayStyle.title")}
      label={(style) => t(`settings.preferences.todayStyle.options.${style}`)}
    />
  );
};
