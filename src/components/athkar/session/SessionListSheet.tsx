import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import {
  Actionsheet,
  ActionsheetCloseButton,
  ActionsheetContent,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useCountText, useRatioText } from "@/hooks/useRatioText";
import { useDhikrText } from "@/hooks/useDhikrText";
import { textIndexAt, type Counts, type SessionItem } from "@/utils/athkarSession";

/** Test ids for the parts a test reaches. */
export const SESSION_LIST_PART = { ROW: "session-list-row", CHECK: "session-list-check" } as const;

export const SESSION_LIST_ROW_MIN_HEIGHT = 56;
/** Rows left in view above the current one when the sheet opens. */
export const SESSION_LIST_LEAD_ROWS = 2;

/** The sheet's one detent, as a share of the screen's height. */
const SNAP = [76];
const NUMBER_MIN_WIDTH = 22;
const END_MIN_WIDTH = 24;
const CHECK_SIZE = 18;
/** Twice the text size: Arabic marks clear the line box. */
const TEXT_LINE_HEIGHT = 32;

type RowProps = {
  item: SessionItem;
  count: number;
  /** The row's place in the session, from 1. */
  place: number;
  current: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const Row = ({ item, count, place, current, onPress, onLayout }: RowProps) => {
  const { t } = useTranslation();
  const { line } = useDhikrText();
  const countText = useCountText();
  const ratioText = useRatioText();
  const done = count >= item.target;
  const text = line(item.texts[textIndexAt(item, count)]);
  const tag = t("athkar.session.current");
  const ratio = ratioText(count, item.target);
  // Spoken as words; a reader says the slash of the drawn ratio as a symbol.
  const counted = t("a11y.athkar.cardProgress", {
    current: countText(count),
    total: countText(item.target),
  });
  const spoken = [text, current ? tag : null, done ? t("a11y.athkar.cardComplete") : counted]
    .filter((part) => part !== null)
    .reduce((first, second) => t("a11y.join", { first, second }));

  return (
    <Pressable
      testID={SESSION_LIST_PART.ROW}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      minHeight={SESSION_LIST_ROW_MIN_HEIGHT}
      paddingVertical="$1"
      paddingHorizontal="$3"
      borderRadius="$control"
      backgroundColor={current ? "$accentTint" : "transparent"}
      pressStyle={{ opacity: 1, backgroundColor: "$pressed" }}
      accessibilityLabel={spoken}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      onLayout={onLayout}>
      <Box minWidth={NUMBER_MIN_WIDTH} alignItems="center">
        {/* The box holds two digits on one line: no end room inside it, and it grows with the text size. */}
        <Text
          size="md"
          fontWeight={current ? "600" : "500"}
          color={current ? "$fg" : "$muted"}
          numeric
          glyph
          numberOfLines={1}>
          {countText(place)}
        </Text>
      </Box>
      <VStack flex={1} minWidth={0}>
        <Text
          size="lg"
          fontWeight={current ? "600" : "500"}
          lineHeight={TEXT_LINE_HEIGHT}
          color={done ? "$muted" : "$fg"}
          isTruncated>
          {text}
        </Text>
        {current ? (
          <Text size="helper" fontWeight="500" color="$muted" paddingBottom="$1">
            {tag}
          </Text>
        ) : null}
      </VStack>
      <Box minWidth={END_MIN_WIDTH} alignItems="center">
        {done ? (
          <Box testID={SESSION_LIST_PART.CHECK}>
            <Icon as={Check} size={CHECK_SIZE} color="$muted" />
          </Box>
        ) : (
          <Text size="helper" fontWeight="500" color="$muted" numeric>
            {ratio}
          </Text>
        )}
      </Box>
    </Pressable>
  );
};

type Props = {
  open: boolean;
  title: string;
  items: readonly SessionItem[];
  counts: Counts;
  /** The current dhikr; null for a finished session. */
  index: number | null;
  onJump: (index: number) => void;
  onClose: () => void;
};

/** The session's dhikr in order; a press on one moves the reader there. */
export const SessionListSheet = ({ open, title, items, counts, index, onJump, onClose }: Props) => {
  const [currentTop, setCurrentTop] = useState<number>();

  // The row's place within the list; the header above it adds to the lead.
  const showCurrent = ({ nativeEvent }: LayoutChangeEvent) => {
    const lead = SESSION_LIST_LEAD_ROWS * SESSION_LIST_ROW_MIN_HEIGHT;
    setCurrentTop(Math.max(0, nativeEvent.layout.y - lead));
  };

  return (
    <Actionsheet isOpen={open} onClose={onClose} snapPoints={SNAP}>
      <ActionsheetContent openAt={currentTop}>
        <VStack gap="$2">
          <HStack alignItems="center" justifyContent="space-between" gap="$3">
            <ActionsheetTitle>
              <Text size="lg" bold typography="title" color="$fg">
                {title}
              </Text>
            </ActionsheetTitle>
            <ActionsheetCloseButton onPress={onClose} />
          </HStack>
          <VStack>
            {items.map((item, i) => (
              <Row
                key={item.id}
                item={item}
                count={counts[item.id] ?? 0}
                place={i + 1}
                current={i === index}
                onPress={() => {
                  onJump(i);
                  onClose();
                }}
                onLayout={i === index ? showCurrent : undefined}
              />
            ))}
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
