import { useWindowDimensions } from "react-native";
import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { ReadAlongGranularity, SpreadPreference } from "@/enums/quran";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import {
  Section,
  SettingRow,
  Segmented,
  Stepper,
} from "@/components/quran/settings/SettingsControls";
import { visibleReaderOptions } from "@/components/quran/settings/visibleReaderOptions";

const ReaderOptionsSection = ({ chrome }: { chrome: QuranChromeColors }) => {
  const { t } = useTranslation();
  const readerMode = useQuranStore((s) => s.readerMode);
  const fontSize = useQuranStore((s) => s.fontSize);
  const spreadPreference = useQuranStore((s) => s.spreadPreference);
  const scrollDirection = useQuranStore((s) => s.scrollDirection);
  const readAlongGranularity = useQuranStore((s) => s.readAlongGranularity);
  const showMutashabihatMarkers = useQuranStore((s) => s.showMutashabihatMarkers);
  const setFontSize = useQuranStore((s) => s.setFontSize);
  const setSpreadPreference = useQuranStore((s) => s.setSpreadPreference);
  const setReadAlongGranularity = useQuranStore((s) => s.setReadAlongGranularity);
  const setShowMutashabihatMarkers = useQuranStore((s) => s.setShowMutashabihatMarkers);

  const { width, height } = useWindowDimensions();
  const visible = visibleReaderOptions({
    readerMode,
    scrollDirection,
    isLargeDevice: Math.min(width, height) >= LARGE_DEVICE_MIN_DP,
  });

  return (
    <Section title={t("quran.settings.display")} chrome={chrome}>
      {visible.fontSize && (
        <SettingRow label={t("quran.settings.fontSize")} chrome={chrome}>
          <XStack
            alignItems="center"
            gap="$3"
            backgroundColor={chrome.cardBorder}
            borderRadius={10}
            paddingHorizontal="$2"
            paddingVertical="$1">
            <Stepper
              icon={Minus}
              disabled={fontSize <= FONT_SIZE_MIN}
              onPress={() => setFontSize(fontSize - FONT_SIZE_STEP)}
              chrome={chrome}
              label={t("a11y.decrease", { defaultValue: "Decrease" })}
            />
            <Text fontSize={14} fontWeight="600" minWidth={28} textAlign="center">
              {fontSize}
            </Text>
            <Stepper
              icon={Plus}
              disabled={fontSize >= FONT_SIZE_MAX}
              onPress={() => setFontSize(fontSize + FONT_SIZE_STEP)}
              chrome={chrome}
              label={t("a11y.increase", { defaultValue: "Increase" })}
            />
          </XStack>
        </SettingRow>
      )}

      {visible.twoPageSpread && (
        <SettingRow label={t("quran.settings.twoPageSpread")} chrome={chrome} stacked>
          <Segmented
            chrome={chrome}
            label={t("quran.settings.twoPageSpread")}
            options={[
              { value: SpreadPreference.AUTO, label: t("quran.settings.spreadAuto") },
              { value: SpreadPreference.ON, label: t("quran.settings.spreadOn") },
              { value: SpreadPreference.OFF, label: t("quran.settings.spreadOff") },
            ]}
            selected={spreadPreference}
            onSelect={setSpreadPreference}
          />
        </SettingRow>
      )}

      <SettingRow label={t("quran.settings.readAlongHighlight")} chrome={chrome} stacked>
        <Segmented
          chrome={chrome}
          label={t("quran.settings.readAlongHighlight")}
          options={[
            { value: ReadAlongGranularity.WORD, label: t("quran.settings.highlightWord") },
            { value: ReadAlongGranularity.AYAH, label: t("quran.settings.highlightAyah") },
          ]}
          selected={readAlongGranularity}
          onSelect={setReadAlongGranularity}
        />
      </SettingRow>

      <SettingRow label={t("quran.settings.showMutashabihatMarkers")} chrome={chrome}>
        {/* native="mobile" renders a platform switch, which reports its own
            role and checked state to the accessibility layer. */}
        <Switch
          value={showMutashabihatMarkers}
          onValueChange={setShowMutashabihatMarkers}
          accessibilityLabel={t("quran.settings.showMutashabihatMarkers")}
        />
      </SettingRow>

      <Text fontSize={12} color={chrome.subtleText} lineHeight={17} paddingHorizontal="$3">
        {t("quran.settings.themeNote")}
      </Text>
    </Section>
  );
};

export default ReaderOptionsSection;
