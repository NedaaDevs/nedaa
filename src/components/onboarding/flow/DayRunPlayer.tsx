import { useEffect, useEffectEvent, useRef } from "react";
import { BackHandler, Platform, StyleSheet, View, type ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react-native";

import { DayRunTrack } from "@/components/onboarding/flow/DayRunTrack";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DAY_RUN_STATUS } from "@/constants/DayRun";
import { useDayRun, type DayRun } from "@/contexts/DayRunContext";
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
  STATUS: "day-run-player-status",
  DONE: "day-run-player-done",
  USE_ADAPTIVE: "day-run-player-use-adaptive",
} as const;

/** The toggle in each status of a started run: what it shows, says and does. */
const TOGGLE = {
  [DAY_RUN_STATUS.PLAYING]: {
    glyph: Pause,
    label: "common.pause",
    hint: "a11y.onboarding.dayPreview.pauseHint",
    press: (run: DayRun) => run.pause(),
  },
  [DAY_RUN_STATUS.PAUSED]: {
    glyph: Play,
    label: "common.play",
    hint: "a11y.onboarding.dayPreview.playHint",
    press: (run: DayRun) => run.resume(),
  },
  [DAY_RUN_STATUS.ENDED]: {
    glyph: RotateCcw,
    label: "a11y.onboarding.dayPreview.replay",
    hint: undefined,
    press: (run: DayRun) => run.start(),
  },
} as const;

// The play triangle points along the reading direction.
const MIRROR = { transform: [{ scaleX: -1 }] };

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

  const status = run?.status ?? DAY_RUN_STATUS.IDLE;
  const phase = run?.phase;
  const join = (first: string, second: string) => t("a11y.join", { first, second });

  // The phase the run draws; past the end, Adaptive itself.
  const lines = phase ? appearancePreview(t, AppMode.ADAPTIVE, scheme, phase) : null;
  const kicker = lines?.kicker ?? t(`settings.themes.${AppMode.ADAPTIVE}.title`);
  const note = lines?.note ?? t(`settings.themes.${AppMode.ADAPTIVE}.description`);
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

  useEffect(() => {
    focusOn(toggleRef.current);
  }, []);

  // Android back ends the run, as Done does, and stays on the step.
  const onBack = useEffectEvent(() => {
    run?.done();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => onBack());
    return () => subscription.remove();
  }, []);

  if (!run || status === DAY_RUN_STATUS.IDLE) return null;

  const toggle = TOGGLE[status];
  const chooseAdaptive = () => {
    run.done();
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
      {announcement && Platform.OS === PlatformType.ANDROID ? (
        // Drawn first, so it sits behind the controls and draws nothing.
        <View
          testID={DAY_RUN_PLAYER_PART.STATUS}
          accessible
          accessibilityLabel={announcement}
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <HStack alignItems="center" gap="$2.5">
        <Pressable
          ref={toggleRef}
          testID={DAY_RUN_PLAYER_PART.TOGGLE}
          accessibilityRole="button"
          accessibilityLabel={t(toggle.label)}
          accessibilityHint={toggle.hint && t(toggle.hint)}
          onPress={() => toggle.press(run)}
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
        <VStack
          testID={DAY_RUN_PLAYER_PART.COPY}
          flex={1}
          accessible
          accessibilityLabel={copyLabel}>
          <HStack alignItems="baseline" gap="$2">
            <Text flex={1} size="label" typography="helper" fontWeight="600" color="$fg">
              {kicker}
            </Text>
            {time ? (
              <Text size="md" typography="helper" fontWeight="600" color="$muted" numeric>
                {time.shown}
              </Text>
            ) : null}
          </HStack>
          <Text size="helper" typography="helper" fontWeight="500" color="$muted">
            {note}
          </Text>
        </VStack>
        <Button
          testID={DAY_RUN_PLAYER_PART.DONE}
          action="primary"
          variant="link"
          onPress={run.done}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.dayPreview.done")}
          accessibilityHint={t("a11y.onboarding.dayPreview.doneHint")}>
          <Button.Text>{t("onboarding.dayPreview.done")}</Button.Text>
        </Button>
      </HStack>
      <DayRunTrack
        phase={phase}
        progress={run.progress}
        valueText={valueText}
        onJump={status === DAY_RUN_STATUS.ENDED ? undefined : run.jumpTo}
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
    </Material>
  );
};
