import { useEffect, useRef, useState, type RefObject } from "react";
import type { HostInstance, ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlarmClock,
  Brain,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Play,
  type LucideIcon,
} from "lucide-react-native";

import { Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { ButtonPair } from "@/components/ui/button-pair";
import { HStack } from "@/components/ui/hstack";
import { IconTile } from "@/components/ui/icon-tile";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  ALARM_GUIDE_CARD,
  ALARM_GUIDE_CARDS,
  ALARM_GUIDE_MAX_WIDTH,
  ALARM_GUIDE_TITLE_KEY,
  type AlarmGuideCardId,
} from "@/constants/AlarmGuide";
import { E2E_ID } from "@/constants/E2E";
import { EMERGENCY_QUIET_ALLOWANCE, EMERGENCY_QUIET_MINUTES } from "@/constants/EmergencyQuiet";
import { WAKE_TASK_MAX_STACK } from "@/constants/WakeTask";
import { useRTL } from "@/contexts/RTLContext";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import { focusOn } from "@/utils/accessibilityFocus";
import { chosenAllowance } from "@/utils/emergencyQuiet";
import { formatNumberToLocale } from "@/utils/number";
import { quietSecondsFor, wayOutSentence } from "@/utils/taskClock";

const CARD_ICON: Record<AlarmGuideCardId, LucideIcon> = {
  [ALARM_GUIDE_CARD.ALARM]: AlarmClock,
  [ALARM_GUIDE_CARD.TASK]: Brain,
  [ALARM_GUIDE_CARD.TRY]: Play,
  [ALARM_GUIDE_CARD.WAY_OUT]: Hourglass,
};

/** A card's sentences, its numbers read from the alarm's own constants. */
const bodyOf = (
  card: AlarmGuideCardId,
  t: TFunction,
  quietSeconds: number,
  emergencyQuiet: boolean
): string[] => {
  switch (card) {
    case ALARM_GUIDE_CARD.ALARM:
      return [t("alarm.guide.alarm.body")];
    case ALARM_GUIDE_CARD.TASK:
      return [t("alarm.guide.task.body"), t("alarm.guide.task.quiet", { count: quietSeconds })];
    case ALARM_GUIDE_CARD.TRY:
      return [
        t("alarm.guide.try.body", { try: t("alarm.task.try") }),
        t("alarm.guide.try.stack", { count: WAKE_TASK_MAX_STACK }),
      ];
    case ALARM_GUIDE_CARD.WAY_OUT:
      return [
        wayOutSentence(t),
        t("alarm.guide.wayOut.sounding"),
        ...(emergencyQuiet
          ? [t("alarm.guide.wayOut.quiet", { count: EMERGENCY_QUIET_MINUTES })]
          : []),
      ];
    default: {
      const unhandled: never = card;
      throw new Error(`no alarm guide card ${String(unhandled)}`);
    }
  }
};

type Props = {
  open: boolean;
  /** Any close: Skip, Done, a swipe or the scrim. */
  onClose: () => void;
  /** Offered on the last card where the screen has tasks to try. */
  onTryTask?: () => void;
  /** Gets reader focus once the guide is gone. */
  finalFocusRef?: RefObject<HostInstance | null>;
};

/** Four cards on how the alarm and its wake-up tasks work. */
const AlarmGuide = ({ open, onClose, onTryTask, finalFocusRef }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const screenReader = useScreenReader();
  const now = useMinuteClock().getTime();
  const emergencyQuiet = useEmergencyQuietStore(
    (state) => chosenAllowance(state.ledger, now) !== EMERGENCY_QUIET_ALLOWANCE.OFF
  );
  const [index, setIndex] = useState(0);
  // Set by Next and Back, so focus moves only on a card change.
  const [moves, setMoves] = useState(0);
  const headingRef = useRef<ViewInstance>(null);

  useEffect(() => {
    if (moves > 0) focusOn(headingRef.current);
  }, [moves]);

  const card = ALARM_GUIDE_CARDS[index];
  const last = index === ALARM_GUIDE_CARDS.length - 1;
  const lines = bodyOf(card, t, quietSecondsFor(screenReader), emergencyQuiet).map(
    formatNumberToLocale
  );
  const title = t(ALARM_GUIDE_TITLE_KEY[card]);
  const place = { at: index + 1, total: ALARM_GUIDE_CARDS.length };
  const BackArrow = isRTL ? ChevronRight : ChevronLeft;
  const NextArrow = isRTL ? ChevronLeft : ChevronRight;

  const move = (by: number) => {
    setIndex((now) => now + by);
    setMoves((count) => count + 1);
  };

  // Each open starts again from the first card.
  const handleClose = () => {
    setIndex(0);
    setMoves(0);
    onClose();
  };

  const done = t("alarm.guide.done");
  const closeHint = t("a11y.alarm.guide.closeHint");

  return (
    <Actionsheet
      isOpen={open}
      onClose={handleClose}
      fitContent
      initialFocusRef={headingRef}
      finalFocusRef={finalFocusRef}>
      <ActionsheetContent>
        <VStack gap="$4" width="100%" maxWidth={ALARM_GUIDE_MAX_WIDTH} alignSelf="center">
          <HStack minHeight="$target" alignItems="center" gap="$2">
            <Box flex={1} alignItems="flex-start">
              {index > 0 ? (
                <Button
                  action="secondary"
                  variant="link"
                  size="sm"
                  onPress={() => move(-1)}
                  accessibilityLabel={t("alarm.guide.back")}>
                  <Button.Icon as={BackArrow} />
                  <Button.Text>{t("alarm.guide.back")}</Button.Text>
                </Button>
              ) : null}
            </Box>
            <Text size="sm" color="$muted" numeric {...HIDDEN_FROM_READER}>
              {formatNumberToLocale(t("alarm.guide.place", place))}
            </Text>
            <Box flex={1} alignItems="flex-end">
              {last ? null : (
                <Button
                  action="secondary"
                  variant="outline"
                  size="sm"
                  minHeight="$target"
                  onPress={onClose}
                  testID={E2E_ID.ALARM_GUIDE_SKIP}
                  accessibilityLabel={t("alarm.guide.skip")}
                  accessibilityHint={closeHint}>
                  <Button.Text>{t("alarm.guide.skip")}</Button.Text>
                </Button>
              )}
            </Box>
          </HStack>

          <VStack gap="$stack" alignItems="flex-start">
            <IconTile icon={CARD_ICON[card]} />
            <Text
              key={card}
              ref={headingRef}
              size="lg"
              bold
              typography="title"
              color="$fg"
              accessibilityRole="header"
              accessibilityLabel={t("a11y.sentences", {
                first: formatNumberToLocale(t("a11y.alarm.guide.place", place)),
                second: title,
              })}>
              {title}
            </Text>
            {lines.map((line) => (
              <Text key={line} size="md" color="$muted">
                {line}
              </Text>
            ))}
          </VStack>

          {!last ? (
            <Button
              action="primary"
              size="lg"
              width="100%"
              onPress={() => move(1)}
              accessibilityLabel={t("alarm.guide.next")}>
              <Button.Text>{t("alarm.guide.next")}</Button.Text>
              <Button.Icon as={NextArrow} />
            </Button>
          ) : onTryTask ? (
            <ButtonPair
              primary={{
                label: t("alarm.guide.tryTask"),
                hint: t("a11y.alarm.guide.tryHint"),
                onPress: onTryTask,
              }}
              secondary={{ label: done, hint: closeHint, onPress: onClose }}
            />
          ) : (
            <Button
              action="primary"
              size="lg"
              width="100%"
              onPress={onClose}
              accessibilityLabel={done}
              accessibilityHint={closeHint}>
              <Button.Text>{done}</Button.Text>
            </Button>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AlarmGuide;
