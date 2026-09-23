import { useEffect, useEffectEvent, useState, type ComponentProps } from "react";
import { Alert, Platform, type AccessibilityActionEvent } from "react-native";

import { Fill } from "@/components/ui/hold-to-confirm/Fill";
import { Icon } from "@/components/ui/icon";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { usePressRetention } from "@/components/ui/pressable/retention";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { PlatformType } from "@/enums/app";
import { useHaptic } from "@/hooks/useHaptic";

/** The default hold, and the haptic tick while it runs. */
export const HOLD = { DEFAULT_MS: 3000, TICK_MS: 500 } as const;

const A11Y_ACTION = { ACTIVATE: "activate" } as const;

// A TalkBack double-tap arrives as this action. VoiceOver's arrives as an accessibility
// tap instead, and would list the action in its rotor under its raw English name.
const activateActions = () =>
  Platform.OS === PlatformType.ANDROID ? [{ name: A11Y_ACTION.ACTIVATE }] : undefined;

type ScreenReaderConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

type Props = {
  label: string;
  onConfirm: () => void;
  /** How long the press must last. */
  durationMs?: number;
  icon?: ComponentProps<typeof Icon>["as"];
  /** Shows a spinner, cancels a hold and refuses a new one, e.g. while the confirmed work runs. */
  busy?: boolean;
  /** A screen reader takes the touch, so it confirms in this dialog instead. */
  screenReaderConfirm: ScreenReaderConfirm;
};

/** A destructive action that runs after a full hold, or after a dialog under a screen reader. */
export const HoldToConfirm = ({
  label,
  onConfirm,
  durationMs = HOLD.DEFAULT_MS,
  icon,
  busy,
  screenReaderConfirm,
}: Props) => {
  const [holding, setHolding] = useState(false);
  const warn = useHaptic("warning");
  const tick = useHaptic("light");
  const fillColor = useThemeColor("$typographyContrast");

  const onTick = useEffectEvent(() => tick());
  // Ends the hold here, or a busy spell after confirm would restart it under the finger.
  const onHeldLongEnough = useEffectEvent(() => {
    setHolding(false);
    onConfirm();
  });

  const retention = usePressRetention(() => setHolding(false));
  const active = holding && !busy;

  useEffect(() => {
    if (!active) return;
    const ticks = setInterval(() => onTick(), HOLD.TICK_MS);
    const done = setTimeout(() => {
      clearInterval(ticks);
      onHeldLongEnough();
    }, durationMs);
    return () => {
      clearInterval(ticks);
      clearTimeout(done);
    };
  }, [active, durationMs]);

  const askToConfirm = () => {
    if (busy) return;
    Alert.alert(screenReaderConfirm.title, screenReaderConfirm.message, [
      { text: screenReaderConfirm.cancelLabel, style: "cancel" },
      { text: screenReaderConfirm.confirmLabel, style: "destructive", onPress: onConfirm },
    ]);
  };

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === A11Y_ACTION.ACTIVATE) askToConfirm();
  };

  // Press-in is gated, press-out never is, so a hold always ends with the finger.
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityActions={activateActions()}
      onAccessibilityAction={handleAccessibilityAction}
      onAccessibilityTap={askToConfirm}
      // Busy, not disabled: a disabled frame drops its press-out, and a hold would outlive the finger.
      accessibilityState={{ busy: Boolean(busy) }}
      onPressIn={
        busy
          ? undefined
          : () => {
              warn();
              setHolding(true);
            }
      }
      onPressOut={() => setHolding(false)}
      {...retention}
      justifyContent="center"
      paddingHorizontal="$group"
      borderRadius="$control"
      overflow="hidden"
      backgroundColor="$error">
      <Fill holding={active} durationMs={durationMs} color={fillColor} />
      <HStack pointerEvents="none" alignItems="center" justifyContent="center" spacing="inline">
        {busy ? (
          <Spinner size="small" color="$typographyContrast" />
        ) : (
          icon && <Icon as={icon} size="md" color="$typographyContrast" />
        )}
        <Text fontWeight="500" color="$typographyContrast">
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
};
