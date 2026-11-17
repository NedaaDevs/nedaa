import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Headphones, Maximize2 } from "lucide-react-native";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { HorizonArc } from "@/components/athkar/looks/horizon/HorizonArc";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { FocusControl } from "@/components/athkar/session/FocusControl";
import { NextDhikr } from "@/components/athkar/session/NextDhikr";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { SpokenStatus } from "@/components/ui/live-region";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HORIZON_ARC, HORIZON_ARC_KIND, HORIZON_PRESS_SCALE } from "@/constants/AthkarHorizon";
import { DURATION_MS } from "@/constants/Motion";
import { useAthkarReader } from "@/hooks/useAthkarReader";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAthkarStore } from "@/stores/athkar";
import { splitAthkarText } from "@/utils/athkarText";

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
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);
  const reduceMotion = useReducedMotion();
  const reader = useAthkarReader(session);
  if (!reader) return null;
  const { current } = reader;
  const locked = current.audioOwnsCount;
  const closed = locked || current.done;

  // The label says what the text draws: the Arabic, then a shown translation.
  const { arabic, translation } = splitAthkarText(t(current.textKey), i18n.language);
  const label = [
    arabic,
    ...(showTranslation && translation ? [translation] : []),
    reader.counted,
  ].reduce((first, second) => t("a11y.join", { first, second }));

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

      <HStack minHeight="$target" alignItems="center" justifyContent="center" gap="$2">
        {closed ? (
          <Text size="lg" fontWeight="500" color="$mutedSky" textAlign="center">
            {reader.hint}
          </Text>
        ) : (
          <HStack alignItems="baseline" gap="$1.5">
            <Text size="lg" fontWeight="600" color="$fg" numeric>
              {reader.countText}
            </Text>
            <Text size="lg" fontWeight="500" color="$mutedSky" numeric>
              {t("athkar.focus.ofTarget", { target: reader.targetText })}
            </Text>
          </HStack>
        )}
        <Button action="primary" variant="link" disabled={!session.canUndo} onPress={session.undo}>
          <Button.Text>{t("athkar.session.undo")}</Button.Text>
        </Button>
      </HStack>

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
        <>
          <NextDhikr
            testID={HORIZON_READER_PART.NEXT}
            next={session.next}
            color="$mutedSky"
            minHeight="$7"
            justifyContent="center"
            marginTop="$3"
          />

          <HStack
            alignItems="center"
            justifyContent="center"
            gap="$3"
            marginTop="$2"
            marginBottom="$3">
            <Pressable
              minHeight="$target"
              flexDirection="row"
              alignItems="center"
              gap="$2"
              paddingHorizontal="$4"
              borderRadius="$pill"
              accessibilityLabel={t("athkar.session.focus.title")}
              accessibilityHint={t("athkar.session.focus.description")}
              onPress={onOpenFocus}>
              <Material
                material={MATERIAL.FLOAT}
                radius="$pill"
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              />
              <Icon as={Maximize2} size="sm" color="$fg" />
              <Text size="md" fontWeight="600" color="$fg">
                {t("athkar.session.focus.title")}
              </Text>
            </Pressable>
            <FocusControl
              icon={Headphones}
              accessibilityLabel={t("a11y.athkar.startAudioSession")}
              onPress={onStartAudio}
            />
          </HStack>
        </>
      )}

      <SpokenStatus message={reader.said} />
    </VStack>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 8 },
});
