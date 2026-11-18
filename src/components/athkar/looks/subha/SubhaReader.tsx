import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { SubhaKnots } from "@/components/athkar/looks/subha/SubhaKnots";
import { SubhaStack } from "@/components/athkar/looks/subha/SubhaSlab";
import { SubhaString } from "@/components/athkar/looks/subha/SubhaString";
import { SubhaTens } from "@/components/athkar/looks/subha/SubhaTens";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { ReaderCount } from "@/components/athkar/session/ReaderCount";
import { ReaderFoot } from "@/components/athkar/session/ReaderFoot";
import { SessionFigures } from "@/components/athkar/session/SessionFigures";
import { SpokenStatus } from "@/components/ui/live-region";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { MARK_STATE } from "@/constants/AthkarSession";
import { SUBHA_SLAB, SUBHA_STRING_KIND } from "@/constants/AthkarSubha";
import { useAthkarReader } from "@/hooks/useAthkarReader";
import { useReaderTextLabel } from "@/hooks/useReaderTextLabel";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the reader's parts. */
export const SUBHA_READER_PART = {
  TEXT: "subha-reader-text",
  SCROLL: "subha-reader-scroll",
  POSITION: "subha-reader-position",
  NEXT: "subha-reader-next",
} as const;

/** Subha's reader: the dhikr on a glass slab, its repeats as beads. */
export const SubhaReader = ({
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
  const waiting = session.marks.filter(({ state }) => state === MARK_STATE.REMAINING).length;

  return (
    <VStack flex={1}>
      <Pressable
        testID={SUBHA_READER_PART.POSITION}
        minHeight="$target"
        justifyContent="center"
        gap="$1"
        paddingHorizontal="$5"
        accessibilityLabel={reader.placeLine}
        accessibilityHint={t("a11y.athkar.sessionListHint")}
        onPress={onOpenList}>
        <SubhaKnots marks={session.marks} />
        <SessionFigures figures={reader.figures} textAlign="center" pointerEvents="none" />
      </Pressable>

      <SubhaStack itemId={current.item.id} waiting={waiting} reduceMotion={reduceMotion}>
        <Pressable
          testID={SUBHA_READER_PART.TEXT}
          flexShrink={1}
          pressStyle={locked ? undefined : { scale: SUBHA_SLAB.PRESS_SCALE }}
          accessibilityLabel={label}
          accessibilityHint={reader.hint}
          accessibilityState={{ disabled: locked }}
          onPress={locked ? undefined : reader.add}>
          {/* Keyed: a group's next text opens at its top. */}
          <ScrollView
            key={current.textKey}
            testID={SUBHA_READER_PART.SCROLL}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <AthkarTextDisplay
              textKey={current.textKey}
              size="headline"
              fontWeight="500"
              color="$fg"
            />
          </ScrollView>
          <VStack marginTop="$4" pointerEvents="none">
            {/* Keyed: a new dhikr starts on a fresh string. */}
            <SubhaString
              key={current.item.id}
              kind={SUBHA_STRING_KIND.READER}
              count={reader.count}
              target={reader.target}
              reduceMotion={reduceMotion}
            />
            <SubhaTens count={reader.count} target={reader.target} reduceMotion={reduceMotion} />
          </VStack>
        </Pressable>
        <VStack marginTop="$2">
          <ReaderCount reader={reader} session={session} />
        </VStack>
      </SubhaStack>

      {trying ? null : (
        <ReaderFoot
          session={session}
          onOpenFocus={onOpenFocus}
          onStartAudio={onStartAudio}
          nextTestID={SUBHA_READER_PART.NEXT}
        />
      )}

      <SpokenStatus message={reader.said} />
    </VStack>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: {
    minHeight: SUBHA_SLAB.TEXT_MIN_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
