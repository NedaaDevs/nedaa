import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { HorizonArc } from "@/components/athkar/looks/horizon/HorizonArc";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { ReaderCount } from "@/components/athkar/session/ReaderCount";
import { ReaderFoot } from "@/components/athkar/session/ReaderFoot";
import { Box } from "@/components/ui/box";
import { SpokenStatus } from "@/components/ui/live-region";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HORIZON_ARC, HORIZON_ARC_KIND, HORIZON_PRESS_SCALE } from "@/constants/AthkarHorizon";
import { DURATION_MS } from "@/constants/Motion";
import { useAthkarReader } from "@/hooks/useAthkarReader";
import { useReaderTextLabel } from "@/hooks/useReaderTextLabel";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the reader's parts. */
export const HORIZON_READER_PART = {
  TEXT: "horizon-reader-text",
  TEXT_SCROLL: "horizon-reader-text-scroll",
  POSITION: "horizon-reader-position",
  NEXT: "horizon-reader-next",
} as const;

const ARC = HORIZON_ARC[HORIZON_ARC_KIND.READER];

/** Horizon's reader: the dhikr on the open sky, its place on the sun's arc. */
export const HorizonReader = ({
  session,
  onOpenList,
  onOpenFocus,
  onStartAudio,
  trying = false,
}: AthkarLookProps) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const reader = useAthkarReader(session);
  const label = useReaderTextLabel(reader);
  if (!reader) return null;
  const { current } = reader;
  const locked = current.audioOwnsCount;

  return (
    <VStack flex={1}>
      <Pressable
        testID={HORIZON_READER_PART.TEXT}
        flex={1}
        marginTop="$3"
        pressStyle={locked ? undefined : { scale: HORIZON_PRESS_SCALE }}
        accessibilityLabel={label}
        accessibilityHint={reader.hint}
        accessibilityState={{ disabled: locked }}
        onPress={locked ? undefined : reader.add}>
        {/* Keyed so each dhikr opens at the top of its text. */}
        <ScrollView
          key={current.textKey}
          testID={HORIZON_READER_PART.TEXT_SCROLL}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(DURATION_MS.GENTLE)}>
            <AthkarTextDisplay
              textKey={current.textKey}
              size="headline"
              fontWeight="500"
              color="$fg"
            />
          </Animated.View>
        </ScrollView>
      </Pressable>

      <ReaderCount reader={reader} session={session} />

      <Pressable
        testID={HORIZON_READER_PART.POSITION}
        alignSelf="center"
        alignItems="center"
        width={ARC.WIDTH}
        height={ARC.HEIGHT}
        accessibilityLabel={reader.placeLine}
        accessibilityHint={t("a11y.athkar.sessionListHint")}
        onPress={onOpenList}>
        <HorizonArc
          kind={HORIZON_ARC_KIND.READER}
          marks={session.marks}
          fraction={reader.fraction}
        />
        <Box position="absolute" bottom={0} pointerEvents="none">
          <Text size="label" fontWeight="500" color="$mutedSky" numeric>
            {reader.figures}
          </Text>
        </Box>
      </Pressable>

      {trying ? null : (
        <ReaderFoot
          session={session}
          onOpenFocus={onOpenFocus}
          onStartAudio={onStartAudio}
          nextTestID={HORIZON_READER_PART.NEXT}
        />
      )}

      <SpokenStatus message={reader.said} />
    </VStack>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 8 },
});
