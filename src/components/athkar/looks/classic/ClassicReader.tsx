import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Headphones } from "lucide-react-native";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { ClassicPosition } from "@/components/athkar/looks/classic/ClassicPosition";
import { CountRing } from "@/components/athkar/looks/classic/CountRing";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { SpokenStatus } from "@/components/ui/live-region";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { DURATION_MS } from "@/constants/Motion";
import { useChangeOnly } from "@/hooks/useChangeOnly";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText, useRatioText } from "@/hooks/useRatioText";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAthkarStore } from "@/stores/athkar";
import { athkarLine } from "@/utils/athkarText";

/** Test ids for the reader's parts. */
export const CLASSIC_READER_PART = {
  HERO: "classic-reader-hero",
  TEXT_SCROLL: "classic-reader-text-scroll",
  NEXT: "classic-reader-next",
  FOCUS: "classic-reader-focus",
} as const;

/** The Classic look of a session in progress: one dhikr and its count. */
export const ClassicReader = ({
  session,
  onOpenList,
  onOpenFocus,
  onStartAudio,
  trying = false,
}: AthkarLookProps) => {
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);
  const countText = useCountText();
  const ratioText = useRatioText();
  const reduceMotion = useReducedMotion();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const lift = useElevationShadow(ELEVATION_LEVEL.E2);

  const { current, index, items } = session;
  const count = current?.count ?? 0;
  const target = current?.target ?? 0;
  const figures = ratioText((index ?? 0) + 1, items.length);
  const ratio = ratioText(count, target);
  // Spoken as words; a reader says the slash of the drawn figures as a symbol.
  const place = t("athkar.audio.thikrProgress", {
    current: countText((index ?? 0) + 1),
    total: countText(items.length),
  });
  const counted = t("a11y.athkar.cardProgress", {
    current: countText(count),
    total: countText(target),
  });
  const said = useChangeOnly(count === 0 ? place : counted);

  if (!current) return null;

  const addCount = t("a11y.athkar.addCount");
  const audioCounts = t("athkar.session.audioCounts");
  const hint = current.audioOwnsCount
    ? audioCounts
    : current.done
      ? t("athkar.session.thikrDone")
      : t("athkar.focus.tapToIncrement");

  const add = () => {
    void hapticSelection();
    if (count + 1 === target) void hapticSuccess();
    session.add();
  };

  return (
    <VStack flex={1}>
      <VStack
        testID={CLASSIC_READER_PART.HERO}
        flex={1}
        alignItems="center"
        justifyContent="space-between"
        marginTop="$3"
        paddingTop="$2"
        paddingHorizontal="$4"
        paddingBottom="$1"
        borderRadius="$hero"
        backgroundColor="$raised"
        style={{ boxShadow: lift }}>
        <HighlightEdge owner={CLASSIC_READER_PART.HERO} radius="$hero" />
        <HStack width="100%" minHeight="$target" alignItems="center" gap="$2">
          <ClassicPosition
            marks={session.marks}
            figures={figures}
            fraction={target > 0 ? count / target : 0}
            accessibilityLabel={place}
            accessibilityHint={t("a11y.athkar.sessionListHint")}
            onPress={onOpenList}
          />
          <Pressable
            alignItems="center"
            justifyContent="center"
            marginEnd="$-2.5"
            borderRadius="$pill"
            pressStyle={{ backgroundColor: "$pressed" }}
            accessibilityLabel={t("a11y.athkar.startAudioSession")}
            onPress={onStartAudio}>
            <Icon as={Headphones} size="lg" color="$muted" />
          </Pressable>
        </HStack>

        {/* Keyed so each dhikr opens at the top of its text. */}
        <ScrollView
          key={current.textKey}
          testID={CLASSIC_READER_PART.TEXT_SCROLL}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Box minHeight="$20" justifyContent="center" paddingVertical="$2">
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(DURATION_MS.GENTLE)}>
              <AthkarTextDisplay
                textKey={current.textKey}
                size="headline"
                fontWeight="500"
                color="$fg"
              />
            </Animated.View>
          </Box>
        </ScrollView>

        <CountRing
          count={count}
          target={target}
          countText={countText(count)}
          targetText={countText(target)}
          valueText={counted}
          disabled={current.audioOwnsCount}
          held={session.advancePending}
          hint={hint}
          accessibilityLabel={
            current.audioOwnsCount
              ? t("a11y.join", { first: addCount, second: audioCounts })
              : addCount
          }
          onPress={add}
        />

        <HStack width="100%" minHeight="$target" alignItems="center" justifyContent="space-between">
          <Text size="label" fontWeight="500" color="$muted" numeric>
            {ratio}
          </Text>
          <Button
            action="primary"
            variant="link"
            marginEnd="$-2.5"
            disabled={!session.canUndo}
            onPress={session.undo}>
            <Button.Text>{t("athkar.session.undo")}</Button.Text>
          </Button>
        </HStack>
      </VStack>

      {trying ? null : (
        <>
          <Box marginTop="$3">
            <ListRow
              testID={CLASSIC_READER_PART.FOCUS}
              title={t("athkar.session.focus.title")}
              status={t("athkar.session.focus.description")}
              wrapStatus
              onPress={onOpenFocus}
            />
          </Box>

          <HStack
            testID={CLASSIC_READER_PART.NEXT}
            minHeight="$8"
            alignItems="center"
            gap="$2"
            marginTop="$1"
            paddingHorizontal="$4">
            {session.next ? (
              <>
                <Text size="md" fontWeight="600" color="$muted">
                  {t("athkar.focus.next")}
                </Text>
                <Text size="md" fontWeight="500" color="$muted" flex={1} isTruncated>
                  {athkarLine(t(session.next.textKey), i18n.language, showTranslation)}
                </Text>
              </>
            ) : (
              <Text size="md" fontWeight="500" color="$muted">
                {t("athkar.session.lastThikr")}
              </Text>
            )}
          </HStack>
        </>
      )}

      <SpokenStatus message={said} />
    </VStack>
  );
};

const styles = StyleSheet.create({
  scroll: { alignSelf: "stretch", flexGrow: 1, flexShrink: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
});
