import { useEffect, useState } from "react";
import { AppState, StyleSheet, type AccessibilityActionEvent } from "react-native";
import { useTranslation } from "react-i18next";

import { COUNT_DIRECTION, Countdown, Rolling } from "@/components/ui/countdown";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { APP_STATE } from "@/constants/AppState";
import { COUNT_AXIS } from "@/constants/Countdown";
import { useFocusPrayer } from "@/hooks/useFocusPrayer";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { localizeDigits } from "@/utils/digits";
import { countReserve, formatCount } from "@/utils/focusCount";
import { spokenDuration } from "@/utils/spokenDuration";

export const FOCUS_COUNTDOWN_PART = {
  ROW: "focus-countdown-row",
  NAME: "focus-countdown-name",
  FIGURE: "focus-countdown-figure",
} as const;

type Props = {
  /** Holds the second clock while its screen is out of focus. */
  paused?: boolean;
};

/** The next prayer by name, and how long until it or since the last one. */
export const FocusCountdown = ({ paused = false }: Props) => {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const focus = useFocusPrayer(flipped, paused);
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  // Each return to the app whirls the figure up from zero again.
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === APP_STATE.ACTIVE) setOpened((times) => times + 1);
    });
    return () => subscription.remove();
  }, []);

  if (!focus) return null;

  const { count, label, name, counted } = focus;
  const digits = (text: string) => localizeDigits(text, locale, western);
  const until = count.axis === COUNT_AXIS.UNTIL;
  const duration = spokenDuration(count, t);

  const flip = () => setFlipped((value) => !value);

  // Name and figure share a baseline; short of room, the figure wraps under.
  return (
    <VStack>
      <Text size="md" typography="helper" fontWeight="600" color="$accentText">
        {label}
      </Text>
      <HStack
        testID={FOCUS_COUNTDOWN_PART.ROW}
        flexWrap="wrap"
        alignItems="baseline"
        justifyContent="space-between"
        columnGap="$4"
        rowGap="$1">
        <VStack
          testID={FOCUS_COUNTDOWN_PART.NAME}
          flexGrow={1}
          flexShrink={0}
          alignItems="flex-start">
          <SkyOccluder>
            {/* The name is the toggle; the caption under the figure says which way. */}
            <Pressable
              accessibilityRole="togglebutton"
              accessibilityLabel={name}
              accessibilityHint={t(until ? "a11y.today.showElapsed" : "a11y.today.showRemaining")}
              accessibilityState={{ checked: !until }}
              accessibilityActions={[{ name: A11Y_ACTION.ACTIVATE }]}
              onAccessibilityAction={({ nativeEvent }: AccessibilityActionEvent) => {
                if (nativeEvent.actionName === A11Y_ACTION.ACTIVATE) flip();
              }}
              onPress={flip}
              justifyContent="center"
              paddingEnd="$2.5"
              borderRadius="$control">
              <Text size="display" bold typography="display" color="$fg" flexShrink={1}>
                {name}
              </Text>
            </Pressable>
          </SkyOccluder>
        </VStack>
        <SkyOccluder testID={FOCUS_COUNTDOWN_PART.FIGURE} style={styles.whole}>
          {/* The caption starts where the figure does, beside the name or under it. */}
          <VStack
            accessible
            accessibilityLabel={t(until ? "a11y.today.untilSpoken" : "a11y.today.sinceSpoken", {
              prayer: counted,
              duration,
            })}
            alignItems="flex-start">
            <Countdown
              value={digits(formatCount(count.seconds, count.precise, count.axis))}
              reserve={digits(countReserve(count))}
              counting={until ? COUNT_DIRECTION.DOWN : COUNT_DIRECTION.UP}
              openKey={opened}
              switchKey={count.axis}
              size="figure"
              fontWeight="600"
              typography="title"
              color="$fg"
            />
            <Rolling
              value={t(until ? "today.focus.until" : "today.focus.since", { prayer: counted })}
              size="helper"
              typography="helper"
              fontWeight="500"
              color="$mutedSky"
            />
          </VStack>
        </SkyOccluder>
      </HStack>
    </VStack>
  );
};

const styles = StyleSheet.create({
  whole: { flexShrink: 0 },
});
