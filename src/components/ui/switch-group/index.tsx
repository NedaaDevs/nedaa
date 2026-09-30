import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { ICON_SIZES, type IconSize } from "@/components/ui/icon/sizing";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DURATION_MS } from "@/constants/Motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the parts that move. */
export const SWITCH_GROUP_PART = {
  BODY: "switch-group-body",
  CONTENT: "switch-group-content",
} as const;

type Props = {
  label: string;
  /** Live state under the label, read with it. */
  summary?: string;
  hint?: string;
  icon?: IconProps["as"];
  value: boolean;
  /** While true the row reads busy and ignores presses. */
  busy?: boolean;
  onValueChange: (value: boolean) => void;
  /** Shown only while the switch is on. */
  children?: ReactNode;
};

const ICON_SIZE: IconSize = "lg";
// The row and the body share this gap, so the body starts where the label does.
const ICON_GAP = "$3";
// The row's side inset; the body repeats it so the two stay aligned.
const ROW_INSET = "$1";

// Reanimated's default curve is an ease in and out.
const TIMING = { duration: DURATION_MS.SETTLE };

// True inside a group's body: a switch there is a setting, not a group.
const Nested = createContext(false);

/** A switch row that opens its body while on; a press on the row toggles. */
export const SwitchGroup = ({
  label,
  summary,
  hint,
  icon,
  value,
  busy = false,
  onValueChange,
  children,
}: Props) => {
  const nested = use(Nested);
  const reduced = useReducedMotion();
  // Mounted while open and while folding shut; gone once closed, so a preview
  // inside cannot outlive its group.
  const [opened, setOpened] = useState(value);
  if (value && !opened) setOpened(true);
  if (!value && opened && reduced) setOpened(false);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    if (reduced) {
      progress.set(target);
      return;
    }
    progress.set(withTiming(target, TIMING));
    if (value) return;
    // Unmounts once the fold has finished; reopening first clears it.
    const unmount = setTimeout(() => setOpened(false), TIMING.duration);
    return () => clearTimeout(unmount);
  }, [value, reduced, progress]);

  const bodyStyle = useAnimatedStyle(() => ({ height: progress.get() * height }));

  return (
    <VStack borderBottomWidth={nested ? undefined : 1} borderColor="$border">
      <Pressable
        onPress={() => onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityLabel={summary ? `${label}, ${summary}` : label}
        accessibilityHint={hint}
        accessibilityState={{ checked: value, busy, disabled: busy }}
        disabled={busy}
        flexDirection="row"
        alignItems="center"
        gap={ICON_GAP}
        minHeight="$14"
        paddingVertical="$1.5"
        paddingHorizontal={ROW_INSET}
        borderRadius="$control"
        pressStyle={{ opacity: 1, backgroundColor: "$pressed" }}>
        {icon ? <Icon as={icon} size={ICON_SIZE} color="$muted" /> : null}
        <VStack flex={1}>
          <Text size="md" typography="title" fontWeight="600" color="$fg">
            {label}
          </Text>
          {summary ? (
            <Text size="sm" typography="helper" color="$muted">
              {summary}
            </Text>
          ) : null}
        </VStack>
        {/* The row is the control; the switch only draws its state. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Switch value={value} />
        </View>
      </Pressable>
      {opened && children ? (
        <Animated.View
          testID={SWITCH_GROUP_PART.BODY}
          style={[styles.body, bodyStyle]}
          accessibilityElementsHidden={!value}
          importantForAccessibility={value ? "auto" : "no-hide-descendants"}>
          {/* Laid out apart from the body, so its height is known as it grows. */}
          <View
            testID={SWITCH_GROUP_PART.CONTENT}
            style={styles.content}
            onLayout={({ nativeEvent }: LayoutChangeEvent) => setHeight(nativeEvent.layout.height)}>
            <HStack gap={ICON_GAP} paddingHorizontal={ROW_INSET} paddingBottom="$3">
              {icon ? <View style={{ width: ICON_SIZES[ICON_SIZE] }} /> : null}
              <VStack flex={1} gap="$3">
                <Nested value>{children}</Nested>
              </VStack>
            </HStack>
          </View>
        </Animated.View>
      ) : null}
    </VStack>
  );
};

const styles = StyleSheet.create({
  body: { overflow: "hidden" },
  content: { position: "absolute", top: 0, start: 0, end: 0 },
});
