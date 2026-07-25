import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

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

      <XStack gap="$2" alignItems="center">
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

        <YStack width={96}>
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
