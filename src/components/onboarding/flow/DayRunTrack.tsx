import { useState } from "react";
import { View, type AccessibilityActionEvent, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION, adjustActions, HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { PHASE, type Phase } from "@/constants/Phase";
import { useRTL } from "@/contexts/RTLContext";
import { AppMode } from "@/enums/app";
import { PHASE_NAME } from "@/utils/appearancePreview";
import { skySwatchFor, type SwatchBand } from "@/utils/sky";

/** Test ids for the parts that take touches or move. */
export const DAY_RUN_TRACK_PART = {
  SEGMENT: "day-run-track-segment",
  PLAYHEAD: "day-run-track-playhead",
} as const;

const PHASES = Object.values(PHASE);
const LAST = PHASES.length - 1;

/** One phase's sky, filling its share of the track. */
const Segment = ({ band, isRTL }: { band: SwatchBand; isRTL: boolean }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <Box
      height="$2"
      borderRadius="$pill"
      overflow="hidden"
      onLayout={({ nativeEvent }: LayoutChangeEvent) => setSize(nativeEvent.layout)}>
      {size.width > 0 ? (
        <SkyPaint
          scene={band.scene}
          celestial={undefined}
          hijriDay={undefined}
          isRTL={isRTL}
          reduced
          width={size.width}
          height={size.height}
          bodies={false}
        />
      ) : null}
    </Box>
  );
};

type Props = {
  /** The run's phase; undefined once the run has ended. */
  phase: Phase | undefined;
  /** How far the run is through its phases, 0 to 1. */
  progress: number;
  /** What the track says for where the run is. */
  valueText: string;
  /** Moves the run to a phase's start and holds it; none once it has ended. */
  onJump: ((phase: Phase) => void) | undefined;
};

/** The day's five phases, equal in length, with the run's place on them. */
export const DayRunTrack = ({ phase, progress, valueText, onJump }: Props) => {
  const { t } = useTranslation();
  const { isRTL, direction } = useRTL();
  const bands = skySwatchFor(AppMode.ADAPTIVE);
  // Past the end the run sits on the last phase.
  const index = phase === undefined ? LAST : PHASES.indexOf(phase);

  const step = (by: number) => {
    const to = Math.min(LAST, Math.max(0, index + by));
    if (to !== index) onJump?.(PHASES[to]);
  };
  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === A11Y_ACTION.INCREMENT) step(1);
    if (nativeEvent.actionName === A11Y_ACTION.DECREMENT) step(-1);
  };

  return (
    <VStack
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("a11y.onboarding.dayPreview.track")}
      accessibilityValue={{ min: 0, max: LAST, now: index, text: valueText }}
      accessibilityActions={adjustActions()}
      onAccessibilityAction={handleAccessibilityAction}
      // Set here too, so the phases run from the reading start in any host.
      style={{ direction }}>
      <VStack {...HIDDEN_FROM_READER}>
        <View>
          <HStack gap="$1">
            {PHASES.map((each, at) => (
              <Pressable
                key={each}
                testID={DAY_RUN_TRACK_PART.SEGMENT}
                flex={1}
                justifyContent="center"
                onPress={onJump && (() => onJump(each))}>
                <Segment band={bands[at]} isRTL={isRTL} />
              </Pressable>
            ))}
          </HStack>
          {/* A zero-wide column at the run's place, the head centred on it. */}
          <View
            testID={DAY_RUN_TRACK_PART.PLAYHEAD}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              start: `${progress * 100}%`,
              width: 0,
              alignItems: "center",
              justifyContent: "center",
            }}>
            <Box
              width="$2.5"
              height="$6"
              borderRadius="$pill"
              backgroundColor="$fg"
              borderWidth={2}
              borderColor="$raised"
            />
          </View>
        </View>
        <HStack marginTop="$-2">
          {PHASES.map((each) => (
            <Text
              key={each}
              flex={1}
              size="sm"
              typography="helper"
              textAlign="center"
              numberOfLines={1}
              fontWeight={each === phase ? "700" : "500"}
              color={each === phase ? "$accentText" : "$muted"}>
              {t(PHASE_NAME[each])}
            </Text>
          ))}
        </HStack>
      </VStack>
    </VStack>
  );
};
