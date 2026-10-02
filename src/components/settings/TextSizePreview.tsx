import { useTranslation } from "react-i18next";

import { PrayerGrid } from "@/components/today/PrayerGrid";
import { TodayHeader } from "@/components/today/TodayHeader";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import type { TextSizeValue } from "@/enums/app";
import { TextScaleContext } from "@/hooks/useTextScale";

/** Test id for the preview frame. */
export const TEXT_SIZE_PREVIEW_PART = { FRAME: "text-size-preview" } as const;

// The cards here only show their state; a press opens nothing.
const IGNORE_PRESS = () => undefined;

/** Today's own header and next-prayer card at one preset; one element. */
export const TextSizePreview = ({ size }: { size: TextSizeValue }) => {
  const { t } = useTranslation();

  return (
    <SkyOccluder>
      <VStack
        testID={TEXT_SIZE_PREVIEW_PART.FRAME}
        accessible
        accessibilityLabel={t("a11y.textSize.preview")}
        pointerEvents="none"
        padding="$3"
        gap="$2"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$sheet"
        backgroundColor="$surface2">
        <Text size="xs" bold color="$fg">
          {t("settings.textSize.preview")}
        </Text>
        <VStack {...HIDDEN_FROM_READER} gap="$3">
          <TextScaleContext value={TEXT_SIZE_MULTIPLIERS[size]}>
            <TodayHeader />
            <PrayerGrid onSelect={IGNORE_PRESS} nextOnly />
          </TextScaleContext>
        </VStack>
      </VStack>
    </SkyOccluder>
  );
};
