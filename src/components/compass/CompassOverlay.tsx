import { MotiView } from "moti";
import { Smartphone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type CompassOverlayProps = {
  variant: "holdFlat" | "calibrate";
  reduceMotion: boolean;
};

/** Self-resolving hint over a dimmed dial. Never has actions; visibility is the screen's job. */
export const CompassOverlay = ({ variant, reduceMotion }: CompassOverlayProps) => {
  const { t } = useTranslation();
  const isCalibrate = variant === "calibrate";

  return (
    <VStack
      position="absolute"
      top={0}
      bottom={0}
      left={0}
      right={0}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      pointerEvents="none"
      accessibilityLiveRegion="polite">
      <MotiView
        {...(reduceMotion || !isCalibrate
          ? {}
          : {
              from: { translateX: -14, rotate: "-12deg" },
              animate: { translateX: 14, rotate: "12deg" },
              transition: { type: "timing", duration: 900, loop: true },
            })}>
        <Icon as={Smartphone} size="xl" color="$primary" />
      </MotiView>
      <Text size="lg" bold textAlign="center" color="$typography">
        {isCalibrate ? t("compass.issue.sensor_uncalibrated.title") : t("compass.holdFlat")}
      </Text>
      {isCalibrate && (
        <Text size="sm" color="$typographySecondary" textAlign="center" paddingHorizontal="$6">
          {t("compass.calibrationNote")}
        </Text>
      )}
    </VStack>
  );
};
