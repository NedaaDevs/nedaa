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
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { TILE_SIZE } from "@/components/ui/icon-tile";
import { Material, MATERIAL } from "@/components/ui/material";
import { Text } from "@/components/ui/text";
import { FONT_SIZES, SIZE_MAP } from "@/components/ui/text/sizing";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { TOAST_KIND, TOAST_MOTION, type ToastKind } from "@/constants/Toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { ToastAction } from "@/utils/toast";

export const TOAST_PART = { FRAME: "toast", ICON: "toast-icon", TINT: "toast-tint" } as const;

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

/** The glyph tile's wash: its kind's colour at this strength. */
const TILE_TINT = 0.14;

/** The action reads at the message's size. */
const ACTION_FONT_SIZE = FONT_SIZES[SIZE_MAP.md].fontSize;

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

  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === TOAST_A11Y_ACTION.DISMISS) onDismiss();
  };

  return (
    // No blur target, so Android draws the float colour opaque.
    <Material
      testID={TOAST_PART.FRAME}
      material={MATERIAL.FLOAT}
      elevation={ELEVATION_LEVEL.E2}
      flexDirection="row"
      alignItems="center"
      gap="$2.5"
      minHeight="$14"
      paddingVertical="$2"
      paddingStart="$3"
      paddingEnd={action ? "$2" : "$3"}>
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
          width={TILE_SIZE}
          height={TILE_SIZE}
          alignItems="center"
          justifyContent="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Box
            testID={TOAST_PART.TINT}
            style={StyleSheet.absoluteFill}
            borderRadius="$chip"
            backgroundColor={signal}
            opacity={TILE_TINT}
          />
          <Turning turning={kind === TOAST_KIND.PROGRESS}>
            <Icon as={GLYPH[kind]} size="lg" color={signal} strokeWidth={1.8} />
          </Turning>
        </Box>
        <Text size="md" typography="helper" fontWeight="600" color="$fg" flex={1}>
          {message}
        </Text>
      </HStack>
      {action && (
        <Button variant="link" onPress={action.onPress} accessibilityLabel={action.label}>
          <Button.Text fontSize={ACTION_FONT_SIZE}>{action.label}</Button.Text>
        </Button>
      )}
    </Material>
  );
};
