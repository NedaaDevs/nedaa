import type { Ref } from "react";
import type { View as NativeView } from "react-native";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react-native";

import {
  TUNED_OTHER_TIMES,
  TUNED_PRAYER_TIMES,
  TUNING_LIMIT,
  clampTuning,
  isTuned,
  signedOffset,
  spokenTuning,
  summarisePrayerTuning,
  summariseTuning,
  timingNameKey,
} from "@/components/calculation/tuning";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { Pill } from "@/components/ui/pill";
import { Stepper } from "@/components/ui/stepper";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useClockTime } from "@/hooks/useClockTime";
import { useDraftTimes } from "@/hooks/useDraftTimes";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import type {
  AladhanPrayerTimeName,
  AladhanSettings,
  AladhanTuning,
} from "@/types/providers/aladhan";

const GROUPED = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];
const NO_TUNING = PRAYER_TIME_PROVIDERS.ALADHAN.tuning;
/** Drawn where a time cannot be known before Apply. */
const UNKNOWN_TIME = "—";

type Props = {
  settings: AladhanSettings;
  onChange: (tune: AladhanTuning) => void;
  /** The timing the sheet opened on, marked and given reader focus. */
  focus?: AladhanPrayerTimeName;
  /** Takes the focused timing's control, for the sheet to focus. */
  focusRef?: Ref<NativeView>;
};

/** A line under the controls, saying why the times are missing. */
const Notice = ({ text }: { text: string }) => (
  <HStack
    alignItems="center"
    gap="$2"
    padding="$3"
    borderRadius="$control"
    backgroundColor="$accentSoft">
    <Icon as={Info} size="sm" color="$accent" />
    <Text size="sm" color="$fg" flex={1}>
      {text}
    </Text>
  </HStack>
);

/** A control per timing, drawn as the time it gives today; prayers first. */
export const TuningEditor = ({ settings, onChange, focus, focusRef }: Props) => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const clock = useClockTime();
  const { today, known, timeOf, calculatedOf } = useDraftTimes(settings);
  const current = settings.tune ?? NO_TUNING;
  const offsetOf = (timing: AladhanPrayerTimeName) => current[timing] ?? 0;

  const row = (timing: AladhanPrayerTimeName) => {
    const name = t(timingNameKey(timing));
    const offset = offsetOf(timing);
    const moved = offset !== 0;
    const words = summarisePrayerTuning(current, timing, t);
    const time = timeOf(timing);
    const calculated = calculatedOf(timing);
    const shown = time && today ? clock(time, today.timezone) : null;
    const base = calculated && today ? clock(calculated, today.timezone) : null;
    const was = (time: string) => t("settings.calculation.tuning.calculated", { time });
    const note = !moved
      ? null
      : base
        ? t("a11y.join", { first: words, second: was(base.shown) })
        : words;
    // The reader hears what the row draws, the calculated time included.
    const spokenOffset =
      moved && base ? t("a11y.join", { first: words, second: was(base.spoken) }) : words;

    return (
      <HStack
        key={timing}
        alignItems="center"
        gap="$3"
        {...GROUPED.frame}
        // A ring, so the stepper's filled buttons still show on the marked row.
        {...(timing === focus && { borderWidth: 2, borderColor: "$accent" })}>
        {/* The control says the name, the time and the offset. */}
        <VStack {...HIDDEN_FROM_READER} flex={2} gap="$0.5">
          <HStack alignItems="center" gap="$2">
            <Text {...GROUPED.title} color="$fg" flexShrink={1}>
              {name}
            </Text>
            {moved ? <Pill tone="accent">{signedOffset(offset, locale, western)}</Pill> : null}
          </HStack>
          {note ? (
            <Text size="xs" color="$muted">
              {note}
            </Text>
          ) : null}
        </VStack>
        {/* Wide enough to hold a 12-hour time on one line between the buttons. */}
        <Box flex={3}>
          <Stepper
            ref={timing === focus ? focusRef : undefined}
            value={offset}
            onChange={(next) => onChange({ ...current, [timing]: clampTuning(next) })}
            min={-TUNING_LIMIT}
            max={TUNING_LIMIT}
            accessibilityLabel={name}
            valueText={
              shown ? t("a11y.join", { first: shown.spoken, second: spokenOffset }) : spokenOffset
            }>
            <Text
              size="md"
              fontWeight="600"
              numeric
              numberOfLines={1}
              color={moved ? "$accent" : "$fg"}>
              {shown ? shown.shown : UNKNOWN_TIME}
            </Text>
          </Stepper>
        </Box>
      </HStack>
    );
  };

  const summary = summariseTuning(current, t);
  const othersOpen = TUNED_OTHER_TIMES.some((timing) => offsetOf(timing) !== 0 || timing === focus);

  return (
    <VStack gap="$3">
      <Text size="sm" color="$muted">
        {t("providers.aladhan.tuning.description")}
      </Text>
      <HStack alignItems="center" justifyContent="space-between" gap="$3">
        <Text
          size="sm"
          fontWeight="600"
          color="$fg"
          flex={1}
          accessibilityLabel={spokenTuning(current, t) ?? undefined}>
          {summary ?? t("prayerDetail.adjustment.none")}
        </Text>
        {/* Stays in place once used, so reader focus has somewhere to rest. */}
        <Button
          action="primary"
          variant="link"
          size="sm"
          disabled={!isTuned(current)}
          onPress={() => onChange({ ...NO_TUNING })}>
          <Button.Text>{t("providers.aladhan.tuning.resetAll")}</Button.Text>
        </Button>
      </HStack>
      {known ? null : (
        <Notice
          text={t(
            today ? "settings.calculation.today.pending" : "settings.calculation.tuning.unavailable"
          )}
        />
      )}
      <ListGroup>{TUNED_PRAYER_TIMES.map(row)}</ListGroup>
      <Disclosure title={t("otherTimings.title")} defaultOpen={othersOpen}>
        <ListGroup>{TUNED_OTHER_TIMES.map(row)}</ListGroup>
      </Disclosure>
    </VStack>
  );
};
