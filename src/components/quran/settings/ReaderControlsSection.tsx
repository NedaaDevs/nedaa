import { useTranslation } from "react-i18next";

import { Section, SettingRow } from "@/components/quran/settings/SettingsControls";
import { Switch } from "@/components/ui/switch";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { usePreferencesStore } from "@/stores/preferences";

/** Sizes the reader's recitation and auto-scroll buttons. */
const ReaderControlsSection = ({ chrome }: { chrome: QuranChromeColors }) => {
  const { t } = useTranslation();
  const largeControls = usePreferencesStore((state) => state.largeControls);
  const setLargeControls = usePreferencesStore((state) => state.setLargeControls);

  return (
    <Section title={t("quran.settings.controls")} chrome={chrome}>
      <SettingRow label={t("quran.settings.largeControls")} chrome={chrome}>
        <Switch
          value={largeControls}
          onValueChange={setLargeControls}
          accessibilityLabel={t("quran.settings.largeControls")}
        />
      </SettingRow>
    </Section>
  );
};

export default ReaderControlsSection;
