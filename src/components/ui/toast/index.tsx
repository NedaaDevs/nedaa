import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { StyleSheet, type AccessibilityActionEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { TOAST_KIND, TOAST_MOTION, type ToastKind } from "@/constants/Toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { ToastAction } from "@/utils/toast";

export const TOAST_PART = { ICON: "toast-icon" } as const;

/** The screen reader's own way to send a toast away. */
export const TOAST_A11Y_ACTION = { DISMISS: "dismiss" } as const;

const SIGNAL = {
  [TOAST_KIND.SUCCESS]: "$success",
  [TOAST_KIND.INFO]: "$accent",
  [TOAST_KIND.PROGRESS]: "$accent",
  [TOAST_KIND.WARNING]: "$warn",
  [TOAST_KIND.ERROR]: "$danger",
} as const satisfies Record<ToastKind, string>;

const GLYPH = {
  [TOAST_KIND.SUCCESS]: CircleCheck,
  [TOAST_KIND.INFO]: Info,
  [TOAST_KIND.PROGRESS]: LoaderCircle,
  [TOAST_KIND.WARNING]: TriangleAlert,
  [TOAST_KIND.ERROR]: CircleAlert,
} as const satisfies Record<ToastKind, IconProps["as"]>;

// The action's words need 4.5:1 on the raised surface; warn reaches only 4.2.
const ACTION_INK = { ...SIGNAL, [TOAST_KIND.WARNING]: "$fg" } as const satisfies Record<
  ToastKind,
  string
>;

/** Spoken before the message: the kind the icon shows by sight. */
const PREFIX_KEY = {
  [TOAST_KIND.SUCCESS]: "a11y.toast.success",
  [TOAST_KIND.INFO]: "a11y.toast.info",
  [TOAST_KIND.PROGRESS]: "a11y.toast.progress",
  [TOAST_KIND.WARNING]: "a11y.toast.warning",
  [TOAST_KIND.ERROR]: "a11y.toast.error",
} as const satisfies Record<ToastKind, string>;

/** The words a screen reader says for a toast. */
export const toastLabel = (t: TFunction, kind: ToastKind, message: string) =>
  `${t(PREFIX_KEY[kind])}: ${message}`;

/** Turns until the outcome replaces it; holds still under Reduce Motion. */
const Turning = ({ turning, children }: { turning: boolean; children: React.ReactNode }) => {
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (!turning || reduced) return;
    const turn = { duration: TOAST_MOTION.spinMs, easing: Easing.linear };
    angle.set(withRepeat(withTiming(360, turn), -1));
    return () => {
      cancelAnimation(angle);
      angle.set(0);
    };
  }, [turning, reduced, angle]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));
  return <Animated.View style={spin}>{children}</Animated.View>;
};

type Props = {
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  onDismiss: () => void;
};

/** A short message: its kind by icon and colour, at most one action. */
export const Toast = ({ kind, message, action, onDismiss }: Props) => {
  const { t } = useTranslation();
  const label = toastLabel(t, kind, message);
  const signal = SIGNAL[kind];
  const shadow = useThemeColor("$shadow");

  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === TOAST_A11Y_ACTION.DISMISS) onDismiss();
  };

  return (
    <HStack
      alignItems="center"
      gap="$2.5"
      minHeight="$14"
      paddingVertical="$2"
      paddingStart="$3"
      paddingEnd={action ? "$2" : "$3"}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$card"
      backgroundColor="$raised"
      style={{ boxShadow: `0px 10px 28px ${shadow}` }}>
      <HStack
        flex={1}
        alignItems="center"
        gap="$2.5"
        accessible
        accessibilityLabel={label}
        accessibilityActions={[{ name: TOAST_A11Y_ACTION.DISMISS, label: t("a11y.toast.dismiss") }]}
        onAccessibilityAction={onAccessibilityAction}>
        <Box
          testID={TOAST_PART.ICON}
          width="$9"
          height="$9"
          alignItems="center"
          justifyContent="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Box
            style={StyleSheet.absoluteFill}
            borderRadius="$control"
            backgroundColor={signal}
            opacity={0.13}
          />
          <Turning turning={kind === TOAST_KIND.PROGRESS}>
            <Icon as={GLYPH[kind]} size="lg" color={signal} strokeWidth={1.8} />
          </Turning>
        </Box>
        <Text size="sm" typography="helper" fontWeight="600" color="$fg" flex={1}>
          {message}
        </Text>
      </HStack>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          justifyContent="center"
          paddingHorizontal="$2"
          borderRadius="$control">
          <Text size="sm" bold color={ACTION_INK[kind]}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </HStack>
  );
};
