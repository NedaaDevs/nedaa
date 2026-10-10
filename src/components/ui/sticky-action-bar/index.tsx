import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { STICKY_ACTION_STATE, type StickyActionState } from "@/constants/StickyActionBar";
import { PlatformType } from "@/enums/app";

/** Test ids for the bar and its status line. */
export const STICKY_ACTION_PART = {
  ROOT: "sticky-action-bar",
  STATUS: "sticky-action-status",
} as const;

type Props = {
  state: StickyActionState;
  label: string;
  /** Shown and announced while the action runs. */
  busyStatus: string;
  onPress: () => void;
};

// Drawn like the tab bar; it sits in the layout, so no row scrolls beneath it.
export const StickyActionBar = ({ state, label, busyStatus, onPress }: Props) => {
  const insets = useSafeAreaInsets();
  const busy = state === STICKY_ACTION_STATE.BUSY;

  // Android speaks the live region below; iOS has no live regions.
  useEffect(() => {
    if (busy && Platform.OS === PlatformType.IOS) {
      AccessibilityInfo.announceForAccessibility(busyStatus);
    }
  }, [busy, busyStatus]);

  if (state === STICKY_ACTION_STATE.HIDDEN) return null;

  return (
    <VStack
      testID={STICKY_ACTION_PART.ROOT}
      gap="$tight"
      paddingHorizontal="$group"
      paddingTop="$2.5"
      paddingBottom={insets.bottom + getTokenValue("$2.5", "space")}
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$bar">
      {busy ? (
        <HStack
          testID={STICKY_ACTION_PART.STATUS}
          accessibilityLiveRegion="polite"
          alignItems="center"
          gap="$1.5">
          <Box width="$2" height="$2" borderRadius="$pill" backgroundColor="$accent" />
          <Text flex={1} size="xs" color="$muted">
            {busyStatus}
          </Text>
        </HStack>
      ) : null}
      <Button
        action="primary"
        variant="solid"
        size="lg"
        disabled={busy}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy }}>
        <Button.Text>{label}</Button.Text>
      </Button>
    </VStack>
  );
};
