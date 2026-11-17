import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";

/** Test ids for the control's parts. */
export const FOCUS_CONTROL_PART = { FILL: "focus-control-fill" } as const;

type Props = {
  icon: ComponentProps<typeof Icon>["as"];
  accessibilityLabel: string;
  /** Painted in the accent: what it controls is on. */
  filled?: boolean;
  /** Working: it takes no press. */
  busy?: boolean;
  onPress: () => void;
};

/** A round floating control of the Focus screen. */
export const FocusControl = ({
  icon,
  accessibilityLabel,
  filled = false,
  busy = false,
  onPress,
}: Props) => (
  <Pressable
    width="$target"
    height="$target"
    alignItems="center"
    justifyContent="center"
    borderRadius="$pill"
    accessibilityLabel={accessibilityLabel}
    // Not `busy`: iOS speaks that state in English.
    accessibilityState={{ disabled: busy }}
    onPress={busy ? undefined : onPress}>
    <Material
      material={MATERIAL.FLOAT}
      radius="$pill"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
    {filled && (
      <Box
        testID={FOCUS_CONTROL_PART.FILL}
        position="absolute"
        inset={0}
        borderRadius="$pill"
        backgroundColor="$accent"
        pointerEvents="none"
      />
    )}
    <Icon as={icon} size="md" color={filled ? "$bg" : "$fg"} />
  </Pressable>
);
