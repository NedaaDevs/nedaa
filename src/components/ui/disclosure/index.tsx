import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the parts that move. */
export const DISCLOSURE_PART = {
  BODY: "disclosure-body",
  CONTENT: "disclosure-content",
  CHEVRON: "disclosure-chevron",
} as const;

/** How long the body takes to open or close. */
export const DISCLOSURE = { ms: 220 } as const;

const TIMING = { duration: DISCLOSURE.ms, easing: Easing.out(Easing.cubic) };

type Props = { title: string; children: ReactNode };

/** A summary row that opens a body below it, the body growing to its height. */
export const Disclosure = ({ title, children }: Props) => {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.set(reduced ? target : withTiming(target, TIMING));
  }, [open, reduced, progress]);

  const body = useAnimatedStyle(() => ({ height: progress.get() * height }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.get() * 180}deg` }],
  }));

  return (
    <VStack borderBottomWidth={1} borderColor="$border">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        gap="$3">
        <Text size="xs" fontWeight="600" color="$fg">
          {title}
        </Text>
        <Animated.View testID={DISCLOSURE_PART.CHEVRON} style={chevron}>
          <Icon as={ChevronDown} size="xs" color="$muted" />
        </Animated.View>
      </Pressable>
      <Animated.View
        testID={DISCLOSURE_PART.BODY}
        style={[styles.body, body]}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
        {/* Laid out apart from the body, so its height is known while closed. */}
        <View
          testID={DISCLOSURE_PART.CONTENT}
          style={styles.content}
          onLayout={({ nativeEvent }: LayoutChangeEvent) => setHeight(nativeEvent.layout.height)}>
          {children}
        </View>
      </Animated.View>
    </VStack>
  );
};

const styles = StyleSheet.create({
  body: { overflow: "hidden" },
  content: { position: "absolute", top: 0, start: 0, end: 0 },
});
