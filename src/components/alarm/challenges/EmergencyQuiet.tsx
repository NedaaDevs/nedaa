import { useEffect, useRef, useState } from "react";
import { View, type ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  EMERGENCY_QUIET_MINUTES,
  EMERGENCY_QUIET_OFFER,
  EMERGENCY_QUIET_PART,
  QUIET_CONFIRM_WAIT_SECONDS,
  SECOND_MS,
} from "@/constants/EmergencyQuiet";
import type { EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useDayMonth } from "@/hooks/useDayMonth";
import type { QuietOffer } from "@/hooks/useQuietOffer";
import { focusOn } from "@/utils/accessibilityFocus";
import { formatNumberToLocale } from "@/utils/number";

type Props = {
  control: EmergencyQuietControl;
  /** Read once by the screen, which hides what the confirm stands in for. */
  offer: QuietOffer;
};

type ConfirmProps = { control: EmergencyQuietControl; onBack: () => void };

/** Asks first; "Quiet now" waits, so a stray tap cannot spend a use. */
const QuietConfirm = ({ control, onBack }: ConfirmProps) => {
  const { t } = useTranslation();
  const title = useRef<ViewInstance>(null);
  const [wait, setWait] = useState(QUIET_CONFIRM_WAIT_SECONDS);
  const ready = wait === 0;

  useEffect(() => focusOn(title.current), []);

  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setWait((left) => left - 1), SECOND_MS);
    return () => clearTimeout(id);
  }, [ready, wait]);

  const back = t("common.back");
  const go = t("alarm.quiet.confirm.go");
  const failed = t("alarm.quiet.failed");
  const pressable = ready && !control.quieting;

  return (
    <VStack
      testID={EMERGENCY_QUIET_PART.CONFIRM}
      gap="$3"
      padding="$4"
      borderRadius="$card"
      borderWidth={2}
      borderColor="$fg"
      backgroundColor="$surface">
      <View ref={title} accessible accessibilityRole="header">
        <Text size="lg" bold color="$fg">
          {t("alarm.quiet.confirm.title")}
        </Text>
      </View>
      <Text size="md" color="$fg">
        {t("alarm.quiet.confirm.body", { count: EMERGENCY_QUIET_MINUTES })}
      </Text>
      {control.failed ? (
        <Text testID={EMERGENCY_QUIET_PART.FAILED} size="md" fontWeight="600" color="$fg">
          {failed}
        </Text>
      ) : (
        <Text size="md" color="$muted">
          {t("alarm.quiet.confirm.cost")}
        </Text>
      )}
      <HStack gap="$stack">
        <Button
          flex={1}
          size="lg"
          action="default"
          variant="outline"
          onPress={onBack}
          accessibilityLabel={back}>
          <Button.Text color="$fg">{back}</Button.Text>
        </Button>
        <Button
          testID={EMERGENCY_QUIET_PART.GO}
          flex={1}
          size="lg"
          action="default"
          variant="outline"
          borderWidth={2}
          borderStyle={ready ? "solid" : "dashed"}
          borderColor={ready ? "$fg" : "$muted"}
          disabled={!pressable}
          onPress={pressable ? control.confirm : undefined}
          accessibilityLabel={go}>
          {!ready && (
            <Box {...HIDDEN_FROM_READER}>
              <Text
                testID={EMERGENCY_QUIET_PART.WAIT}
                size="lg"
                fontWeight="600"
                color="$muted"
                numeric>
                {formatNumberToLocale(String(wait))}
              </Text>
            </Box>
          )}
          <Button.Text color={ready ? "$fg" : "$muted"}>{go}</Button.Text>
        </Button>
      </HStack>
      <SpokenStatus
        testID={EMERGENCY_QUIET_PART.READY_STATUS}
        message={ready && !control.failed ? t("a11y.alarm.quiet.ready", { go }) : null}
      />
      <SpokenStatus
        testID={EMERGENCY_QUIET_PART.FAILED_STATUS}
        message={control.failed ? failed : null}
      />
    </VStack>
  );
};

/** Opens the confirm; takes the reader's focus when Back closes it. */
const QuietButton = ({ onPress, focused }: { onPress: () => void; focused: boolean }) => {
  const { t } = useTranslation();
  const button = useRef<ViewInstance>(null);
  const label = t("alarm.quiet.button");

  useEffect(() => {
    if (focused) focusOn(button.current);
  }, [focused]);

  return (
    <Button
      ref={button}
      testID={EMERGENCY_QUIET_PART.BUTTON}
      variant="link"
      action="default"
      alignSelf="center"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={t("a11y.alarm.quiet.buttonHint")}>
      <Button.Text color="$muted" textDecorationLine="underline">
        {label}
      </Button.Text>
    </Button>
  );
};

/** A ringing alarm's emergency quiet: the offer, its confirm, or why not. */
const EmergencyQuiet = ({ control, offer }: Props) => {
  const { t } = useTranslation();
  const dayMonth = useDayMonth();
  const [backed, setBacked] = useState(false);

  switch (offer.offer) {
    case EMERGENCY_QUIET_OFFER.OFFER:
      return offer.confirmOpen ? (
        <QuietConfirm
          control={control}
          onBack={() => {
            setBacked(true);
            control.back();
          }}
        />
      ) : (
        <QuietButton
          focused={backed}
          onPress={() => {
            setBacked(false);
            control.open();
          }}
        />
      );
    case EMERGENCY_QUIET_OFFER.NONE_LEFT:
      return (
        <Text testID={EMERGENCY_QUIET_PART.NONE_LEFT} size="md" color="$muted" textAlign="center">
          {t("alarm.quiet.noneLeft", { date: dayMonth(offer.refillsOn) })}
        </Text>
      );
    case EMERGENCY_QUIET_OFFER.USED:
      return (
        <Text testID={EMERGENCY_QUIET_PART.USED} size="md" color="$muted" textAlign="center">
          {t("alarm.quiet.used")}
        </Text>
      );
    case EMERGENCY_QUIET_OFFER.ON:
    case EMERGENCY_QUIET_OFFER.HIDDEN:
      return null;
  }
};

export default EmergencyQuiet;
