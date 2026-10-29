import { useRef } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkySwatch } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { DAY_RUN_STATUS } from "@/constants/DayRun";
import { SKY_SWATCH_SIZE } from "@/constants/Sky";
import { useDayRun } from "@/contexts/DayRunContext";
import { AppMode } from "@/enums/app";
import { skySwatchFor } from "@/utils/sky";

/** Test ids for the button's parts. */
export const PLAY_DAY_PART = {
  BUTTON: "play-day-button",
  MARK: "play-day-mark",
} as const;

// The play triangle points along the reading direction.
const MIRROR = { transform: [{ scaleX: -1 }] };

/** Plays a day of Adaptive; the player's own close brings focus back here. */
export const PlayDayButton = () => {
  const { t } = useTranslation();
  const run = useDayRun();
  const sky = usePageSky();
  const buttonRef = useRef<ViewInstance>(null);

  if (!run) return null;

  // The run's methods are stable from tick to tick; the run itself is not.
  const { start } = run;
  const label = t("onboarding.appearance.playDay");

  return (
    <Button
      ref={buttonRef}
      testID={PLAY_DAY_PART.BUTTON}
      action="primary"
      variant="outline"
      disabled={run.status !== DAY_RUN_STATUS.IDLE || !run.available}
      onPress={() => start(buttonRef.current)}
      justifyContent="flex-start"
      gap="$3"
      paddingVertical="$2.5"
      paddingHorizontal="$2.5"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("a11y.onboarding.playDayHint")}>
      <SkySwatch
        bands={skySwatchFor(AppMode.ADAPTIVE)}
        hijriDay={sky.hijriDay}
        isRTL={sky.isRTL}
        size={SKY_SWATCH_SIZE.BUTTON}
      />
      <Text flex={1} size="label" typography="helper" fontWeight="600" color="$accentText">
        {label}
      </Text>
      <Box
        testID={PLAY_DAY_PART.MARK}
        width="$8"
        height="$8"
        borderRadius="$pill"
        backgroundColor="$accent"
        alignItems="center"
        justifyContent="center"
        style={sky.isRTL ? MIRROR : undefined}>
        <Icon as={Play} size="xs" color="$bg" fill="$bg" />
      </Box>
    </Button>
  );
};
