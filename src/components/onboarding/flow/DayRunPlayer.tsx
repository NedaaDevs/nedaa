import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewInstance,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Pause, Play, RotateCcw } from "lucide-react-native";

import { DayRunTrack } from "@/components/onboarding/flow/DayRunTrack";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { digitsOf, DigitSlot, type DigitTextProps } from "@/components/ui/digit-reserve";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";
import { Text, TEXT_END_ROOM } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { DAY_RUN_CLOCK_SAMPLES, DAY_RUN_STATUS } from "@/constants/DayRun";
import { PHASE } from "@/constants/Phase";
import { useDayRun } from "@/contexts/DayRunContext";
import { useRTL } from "@/contexts/RTLContext";
import { useAppScheme } from "@/contexts/SchemeContext";
import { AppMode, PlatformType } from "@/enums/app";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useClockTime } from "@/hooks/useClockTime";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { focusOn } from "@/utils/accessibilityFocus";
import { appearancePreview, PHASE_NAME } from "@/utils/appearancePreview";

/** Test ids for the player's parts. */
export const DAY_RUN_PLAYER_PART = {
  FRAME: "day-run-player",
  TOGGLE: "day-run-player-toggle",
  GLYPH: "day-run-player-glyph",
  COPY: "day-run-player-copy",
  COPY_SIZERS: "day-run-player-copy-sizers",
  COPY_SIZER: "day-run-player-copy-sizer",
  TIME_SLOT: "day-run-player-time-slot",
  CLOCK_RESERVE: "day-run-player-clock-reserve",
  DIGIT_SIZER: "day-run-player-digit-sizer",
  STATUS: "day-run-player-status",
  DONE: "day-run-player-done",
  USE_ADAPTIVE: "day-run-player-use-adaptive",
} as const;

/** The toggle in each status of a started run: what it shows and says. */
const TOGGLE = {
  [DAY_RUN_STATUS.PLAYING]: {
    glyph: Pause,
    label: "common.pause",
    hint: "a11y.onboarding.dayPreview.pauseHint",
  },
  [DAY_RUN_STATUS.PAUSED]: {
    glyph: Play,
    label: "common.play",
    hint: "a11y.onboarding.dayPreview.playHint",
  },
  [DAY_RUN_STATUS.ENDED]: {
    glyph: RotateCcw,
    label: "a11y.onboarding.dayPreview.replay",
    hint: undefined,
  },
} as const;

// The play triangle points along the reading direction.
const MIRROR = { transform: [{ scaleX: -1 }] };

const PHASES = Object.values(PHASE);

const TIME_TEXT = {
  size: "md",
  typography: "helper",
  fontWeight: "600",
  color: "$muted",
  numeric: true,
} as const satisfies DigitTextProps;

/** A piece of the reserve, measured exactly; its row adds the end room once. */
const RESERVE_TEXT = { ...TIME_TEXT, glyph: true } as const satisfies DigitTextProps;

/** A clock time as the card draws it. */
const TimeText = ({ children }: { children: ReactNode }) => <Text {...TIME_TEXT}>{children}</Text>;

/** A clock's digits one by one, and the text between them in runs. */
const clockRuns = (clock: string): string[] => {
  const runs: string[] = [];
  for (const character of clock) {
    const last = runs.length - 1;
    const joins = last >= 0 && !digitsOf(character) && !digitsOf(runs[last].slice(-1));
    if (joins) runs[last] += character;
    else runs.push(character);
  }
  return runs;
};

/** Each clock sample, every digit as wide as its script's widest; no height. */
const ClockReserve = () => {
  const clockTime = useClockTime();
  // A two-digit hour, morning and evening, in the reader's clock and digits.
  const samples = DAY_RUN_CLOCK_SAMPLES.ISOS.map(
    (iso) => clockTime(new Date(iso), DAY_RUN_CLOCK_SAMPLES.TIMEZONE).shown
  );
  return (
    <View style={styles.reserve} {...HIDDEN_FROM_READER}>
      {samples.map((sample, index) => (
        // The live time is one Text with the end room once; so is each row.
        <HStack key={index} testID={DAY_RUN_PLAYER_PART.CLOCK_RESERVE} paddingEnd={TEXT_END_ROOM}>
          {clockRuns(sample).map((run, at) => (
            <DigitSlot
              key={at}
              text={run}
              textProps={RESERVE_TEXT}
              sizerTestID={DAY_RUN_PLAYER_PART.DIGIT_SIZER}
            />
          ))}
        </HStack>
      ))}
    </View>
  );
};

type Copy = { kicker: string; note: string };

/** The copy past the end of a run: Adaptive itself. */
const adaptiveCopy = (t: TFunction): Copy => ({
  kicker: t(`settings.themes.${AppMode.ADAPTIVE}.title`),
  note: t(`settings.themes.${AppMode.ADAPTIVE}.description`),
});

/** The card's words: the kicker with `trailing` beside it, then the note. */
const CopyLines = ({ kicker, note, trailing }: Copy & { trailing: ReactNode }) => (
  <>
    <HStack alignItems="baseline" gap="$2">
      <Text flex={1} size="label" typography="helper" fontWeight="600" color="$fg">
        {kicker}
      </Text>
      {trailing}
    </HStack>
    <Text size="helper" typography="helper" fontWeight="500" color="$muted">
      {note}
    </Text>
  </>
);

type SlotProps = { time: string; onWidth: (width: number) => void };

/** The time, flush at the end of a slot wide enough for any clock. */
const TimeSlot = ({ time, onWidth }: SlotProps) => (
  <View
    testID={DAY_RUN_PLAYER_PART.TIME_SLOT}
    style={styles.timeSlot}
    onLayout={({ nativeEvent }: LayoutChangeEvent) => onWidth(nativeEvent.layout.width)}>
    <TimeText>{time}</TimeText>
    <ClockReserve />
  </View>
);

/** Every copy the run can show, unseen: the cell holds the tallest's height. */
const CopySizers = ({ slotWidth }: { slotWidth: number }) => {
  const { t } = useTranslation();
  const scheme = useAppScheme();
  // A phase's kicker shares its line with the time slot; the end's has none.
  const slot = <View style={{ width: slotWidth }} />;
  const copies = [
    ...PHASES.map((each) => {
      const { kicker, note } = appearancePreview(t, AppMode.ADAPTIVE, scheme, each);
      return { key: each, kicker, note, trailing: slot };
    }),
    { key: DAY_RUN_STATUS.ENDED, ...adaptiveCopy(t), trailing: null },
  ];
  return (
    <HStack
      testID={DAY_RUN_PLAYER_PART.COPY_SIZERS}
      overflow="hidden"
      opacity={0}
      pointerEvents="none"
      {...HIDDEN_FROM_READER}>
      {copies.map(({ key, ...copy }) => (
        <VStack key={key} testID={DAY_RUN_PLAYER_PART.COPY_SIZER} width="100%" flexShrink={0}>
          <CopyLines {...copy} />
        </VStack>
      ))}
    </HStack>
  );
};

/** A day run's controls, drawn by the frame in place of its bottom bar. */
export const DayRunPlayer = () => {
  const { t } = useTranslation();
  const run = useDayRun();
  const mode = useAppStore((state) => state.mode);
  const scheme = useAppScheme();
  const chooseMode = useChooseMode();
  const clockTime = useClockTime();
  const { now, day } = useShownDay();
  const { isRTL } = useRTL();
  const toggleRef = useRef<ViewInstance>(null);
  // Reader focus goes to the toggle once its view exists, once per player.
  const toggleFocused = useRef(false);
  const focusToggle = () => {
    if (toggleFocused.current) return;
    toggleFocused.current = true;
    focusOn(toggleRef.current);
  };
  // The live slot's width, which the sizers reserve beside each kicker.
  const [slotWidth, setSlotWidth] = useState(0);

  const status = run?.status ?? DAY_RUN_STATUS.IDLE;
  const phase = run?.phase;
  const join = (first: string, second: string) => t("a11y.join", { first, second });

  // The phase the run draws; past the end, Adaptive itself.
  const lines = phase ? appearancePreview(t, AppMode.ADAPTIVE, scheme, phase) : adaptiveCopy(t);
  const { kicker, note } = lines;
  const time = phase && day ? clockTime(now, day.timezone) : null;
  const copyLabel = join(time ? join(kicker, time.spoken) : kicker, note);
  const phaseName = phase ? t(PHASE_NAME[phase]) : kicker;
  const valueText = time ? join(phaseName, time.spoken) : phaseName;

  // Said where the run stops; a phase passes too fast to say each one.
  const announcement =
    status === DAY_RUN_STATUS.PAUSED
      ? copyLabel
      : status === DAY_RUN_STATUS.ENDED
        ? t("a11y.onboarding.dayPreview.ended")
        : null;
  // Android speaks the live region below; iOS has no live regions.
  useIosAnnouncement(announcement);

  // Android back closes the run, as Done does, and stays on the step.
  const onBack = useEffectEvent(() => {
    run?.close();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => onBack());
    return () => subscription.remove();
  }, []);

  if (!run || status === DAY_RUN_STATUS.IDLE) return null;

  // The run's methods are stable from tick to tick; the run itself is not.
  const { pause, resume, replay, jumpTo, close, progress } = run;
  const toggle = TOGGLE[status];
  const press = {
    [DAY_RUN_STATUS.PLAYING]: pause,
    [DAY_RUN_STATUS.PAUSED]: resume,
    [DAY_RUN_STATUS.ENDED]: replay,
  }[status];
  const chooseAdaptive = () => {
    close();
    void chooseMode(AppMode.ADAPTIVE);
  };

  return (
    // No blur target, so Android draws the float colour opaque.
    <Material
      testID={DAY_RUN_PLAYER_PART.FRAME}
      material={MATERIAL.FLOAT}
      ring
      gap="$0.5"
      paddingTop="$2.5"
      paddingHorizontal="$3"
      paddingBottom="$3">
      <HStack alignItems="center" gap="$2.5">
        <Pressable
          ref={toggleRef}
          testID={DAY_RUN_PLAYER_PART.TOGGLE}
          accessibilityRole="button"
          accessibilityLabel={t(toggle.label)}
          accessibilityHint={toggle.hint && t(toggle.hint)}
          onPress={press}
          onLayout={focusToggle}
          width="$target"
          height="$target"
          borderRadius="$pill"
          backgroundColor="$accent"
          alignItems="center"
          justifyContent="center">
          <View
            testID={DAY_RUN_PLAYER_PART.GLYPH}
            pointerEvents="none"
            style={toggle.glyph === Play && isRTL ? MIRROR : undefined}>
            <Icon
              as={toggle.glyph}
              size="md"
              color="$bg"
              fill={toggle.glyph === RotateCcw ? undefined : "$bg"}
            />
          </View>
        </Pressable>
        <Box flex={1}>
          <CopySizers slotWidth={slotWidth} />
          <VStack
            testID={DAY_RUN_PLAYER_PART.COPY}
            position="absolute"
            top={0}
            left={0}
            right={0}
            accessible
            accessibilityLabel={copyLabel}>
            <CopyLines
              kicker={kicker}
              note={note}
              trailing={time ? <TimeSlot time={time.shown} onWidth={setSlotWidth} /> : null}
            />
          </VStack>
        </Box>
        <Button
          testID={DAY_RUN_PLAYER_PART.DONE}
          action="primary"
          variant="link"
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.dayPreview.done")}
          accessibilityHint={t("a11y.onboarding.dayPreview.doneHint")}>
          <Button.Text>{t("onboarding.dayPreview.done")}</Button.Text>
        </Button>
      </HStack>
      <DayRunTrack
        phase={phase}
        progress={progress}
        valueText={valueText}
        onJump={status === DAY_RUN_STATUS.ENDED ? undefined : jumpTo}
      />
      {mode === AppMode.ADAPTIVE ? null : (
        // Offered for the whole run, so the card keeps one height.
        <Button
          testID={DAY_RUN_PLAYER_PART.USE_ADAPTIVE}
          action="primary"
          variant="solid"
          size="md"
          marginTop="$2"
          onPress={chooseAdaptive}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.dayPreview.useAdaptive")}
          accessibilityHint={t("a11y.onboarding.dayPreview.useAdaptiveHint")}>
          <Button.Text>{t("onboarding.dayPreview.useAdaptive")}</Button.Text>
        </Button>
      )}
      {Platform.OS === PlatformType.ANDROID ? (
        // Mounted for the player's life: Android says a changed label.
        <Box
          testID={DAY_RUN_PLAYER_PART.STATUS}
          position="absolute"
          bottom={0}
          width="$0.5"
          height="$0.5"
          pointerEvents="none"
          importantForAccessibility="yes"
          accessible={announcement !== null}
          accessibilityLabel={announcement ?? ""}
          accessibilityLiveRegion="polite"
        />
      ) : null}
    </Material>
  );
};

const styles = StyleSheet.create({
  timeSlot: { alignItems: "flex-end" },
  // No height, so the samples set only the slot's width.
  reserve: { height: 0, overflow: "hidden" },
});
