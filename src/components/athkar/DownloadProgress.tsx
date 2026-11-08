import { FC } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

type Props = {
  completed: number;
  total: number;
  /** A second pass over the files that failed. */
  retrying?: boolean;
};

const DownloadProgress: FC<Props> = ({ completed, total, retrying = false }) => {
  const { t } = useTranslation();
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <VStack gap="$2">
      <HStack justifyContent="space-between" alignItems="center">
        <Text size="sm" color="$typographySecondary">
          {retrying ? t("athkar.audio.retrying") : t("athkar.audio.downloading")}
        </Text>
        <Text size="sm" color="$typographySecondary">
          {completed}/{total}
        </Text>
      </HStack>
      <Progress
        value={percentage}
        size="sm"
        backgroundColor="$backgroundMuted"
        accessibilityLabel={retrying ? t("a11y.athkar.retrying") : t("a11y.athkar.downloading")}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }}>
        <ProgressFilledTrack backgroundColor="$primary" />
      </Progress>
    </VStack>
  );
};

export default DownloadProgress;
