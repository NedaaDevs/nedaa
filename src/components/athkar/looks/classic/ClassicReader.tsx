import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Headphones } from "lucide-react-native";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { ClassicPosition } from "@/components/athkar/looks/classic/ClassicPosition";
import { CountRing } from "@/components/athkar/looks/classic/CountRing";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { NextDhikr } from "@/components/athkar/session/NextDhikr";
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
import { DURATION_MS } from "@/constants/Motion";
import { useAthkarReader } from "@/hooks/useAthkarReader";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const lift = useElevationShadow(ELEVATION_LEVEL.E2);
  const reader = useAthkarReader(session);
  if (!reader) return null;
  const { current, count, target } = reader;

  const addCount = t("a11y.athkar.addCount");

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
            figures={reader.figures}
            fraction={reader.fraction}
            accessibilityLabel={reader.placeLine}
            accessibilityHint={t("a11y.athkar.sessionListHint")}
            onPress={onOpenList}
          />
          {trying || !onStartAudio ? null : (
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
          )}
        </HStack>

        {/* Keyed so each dhikr opens at the top of its text. */}
        <ScrollView
          key={current.textId}
          testID={CLASSIC_READER_PART.TEXT_SCROLL}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Box minHeight="$20" justifyContent="center" paddingVertical="$2">
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(DURATION_MS.GENTLE)}>
              <AthkarTextDisplay text={current.text} size="headline" fontWeight="500" color="$fg" />
            </Animated.View>
          </Box>
        </ScrollView>

        <CountRing
          count={count}
          target={target}
          countText={reader.countText}
          targetText={reader.targetText}
          valueText={reader.counted}
          disabled={current.audioOwnsCount}
          held={session.advancePending}
          hint={reader.hint}
          accessibilityLabel={
            current.audioOwnsCount
              ? t("a11y.join", { first: addCount, second: reader.hint })
              : addCount
          }
          onPress={reader.add}
        />

        <HStack width="100%" minHeight="$target" alignItems="center" justifyContent="space-between">
          <Text size="label" fontWeight="500" color="$muted" numeric>
            {reader.ratio}
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

          <NextDhikr
            testID={CLASSIC_READER_PART.NEXT}
            next={session.next}
            color="$muted"
            minHeight="$8"
            marginTop="$1"
          />
        </>
      )}

      <SpokenStatus message={reader.said} />
    </VStack>
  );
};

const styles = StyleSheet.create({
  scroll: { alignSelf: "stretch", flexGrow: 1, flexShrink: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
});
