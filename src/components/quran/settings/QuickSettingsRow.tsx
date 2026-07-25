import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { ReaderViewMode, ScrollDirection } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { Segmented } from "@/components/quran/settings/SettingsControls";
import { ScrollDirectionIcon } from "@/components/quran/settings/ScrollDirectionIcon";
import ReadingThemeSwatches from "@/components/quran/settings/ReadingThemeSwatches";

// The settings a reader changes mid-session, pinned above the scroll so they
// are reachable at any content length.
const QuickSettingsRow = ({ chrome }: { chrome: QuranChromeColors }) => {
  const { t } = useTranslation();
  const readerMode = useQuranStore((s) => s.readerMode);
  const scrollDirection = useQuranStore((s) => s.scrollDirection);
  const setReaderMode = useQuranStore((s) => s.setReaderMode);
  const setScrollDirection = useQuranStore((s) => s.setScrollDirection);

  return (
    <YStack gap="$3" paddingBottom="$4">
      <ReadingThemeSwatches />

      {/* Pills bottom-align so the scroll control's caption sits above the row
          rather than pushing its pill out of line with the mode pill. */}
      <XStack gap="$2" alignItems="flex-end">
        <YStack flex={1}>
          <Segmented
            chrome={chrome}
            label={t("quran.settings.readerMode")}
            options={[
              { value: ReaderViewMode.MADINAH, label: t("quran.settings.modeMushaf") },
              { value: ReaderViewMode.TEXT, label: t("quran.settings.modeText") },
            ]}
            selected={readerMode}
            onSelect={setReaderMode}
          />
        </YStack>

        <YStack width={96} gap="$1.5">
          {/* The segments are icon-only, so the caption carries their meaning. */}
          <Text fontSize={11} color={chrome.subtleText} textAlign="center" numberOfLines={1}>
            {t("quran.settings.scrollDirection")}
          </Text>
          <Segmented
            chrome={chrome}
            compact
            iconOnly
            label={t("quran.settings.scrollDirection")}
            options={[
              {
                value: ScrollDirection.HORIZONTAL,
                label: t("quran.settings.scrollHorizontal"),
                icon: ({ color }) => (
                  <ScrollDirectionIcon direction={ScrollDirection.HORIZONTAL} color={color} />
                ),
              },
              {
                value: ScrollDirection.VERTICAL,
                label: t("quran.settings.scrollVertical"),
                icon: ({ color }) => (
                  <ScrollDirectionIcon direction={ScrollDirection.VERTICAL} color={color} />
                ),
              },
            ]}
            selected={scrollDirection}
            onSelect={setScrollDirection}
          />
        </YStack>
      </XStack>
    </YStack>
  );
};

export default QuickSettingsRow;
