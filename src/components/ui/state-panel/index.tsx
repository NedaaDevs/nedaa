import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { CircleAlert, Clock, Hourglass, type LucideIcon } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { STATE_PANEL_KIND, type StatePanelKind } from "@/constants/StatePanel";
import { PlatformType } from "@/enums/app";

/** What a panel or callout offers: a labelled press, with a hint when unclear. */
export type StateAction = { label: string; hint?: string; onPress: () => void };

/** Test ids for each kind's icon. */
export const STATE_PANEL_ICON_ID: Record<StatePanelKind, string> = {
  [STATE_PANEL_KIND.LOADING]: "state-panel-icon-loading",
  [STATE_PANEL_KIND.UNAVAILABLE]: "state-panel-icon-unavailable",
  [STATE_PANEL_KIND.ERROR]: "state-panel-icon-error",
};

// Static icons: a wait never spins, so Reduce Motion has nothing to stop.
const KIND_ICON: Record<StatePanelKind, { icon: LucideIcon; color: string }> = {
  [STATE_PANEL_KIND.LOADING]: { icon: Hourglass, color: "$muted" },
  [STATE_PANEL_KIND.UNAVAILABLE]: { icon: Clock, color: "$warn" },
  [STATE_PANEL_KIND.ERROR]: { icon: CircleAlert, color: "$danger" },
};

type Props = {
  title: string;
  body: string;
  kind?: StatePanelKind;
  /** The way on; a wait has none. */
  action?: StateAction;
};

/** A state in place of content: what is happening, and the way on. */
export const StatePanel = ({ title, body, kind = STATE_PANEL_KIND.ERROR, action }: Props) => {
  const message = `${title}. ${body}`;
  const { icon, color } = KIND_ICON[kind];

  // Android speaks the live region below; iOS has no live regions.
  useEffect(() => {
    if (Platform.OS === PlatformType.IOS) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <VStack
      alignItems="center"
      gap="$1.5"
      paddingVertical="$5"
      paddingHorizontal="$4"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$sheet"
      backgroundColor="$surface2">
      {/* The message is one announced element; the action stays reachable beside it. */}
      <VStack
        alignItems="center"
        gap="$1.5"
        accessible
        accessibilityLabel={message}
        accessibilityLiveRegion="polite">
        <Box testID={STATE_PANEL_ICON_ID[kind]}>
          <Icon as={icon} size="lg" color={color} />
        </Box>
        <Text size="md" bold color="$fg" textAlign="center">
          {title}
        </Text>
        <Text size="sm" color="$muted" textAlign="center">
          {body}
        </Text>
      </VStack>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityLabel={action.label}
          accessibilityHint={action.hint}
          marginTop="$2"
          paddingHorizontal="$4"
          justifyContent="center"
          borderWidth={1}
          borderColor="$accent"
          borderRadius="$pill"
          backgroundColor="$accentSoft">
          <Text size="sm" fontWeight="600" color="$fg">
            {action.label}
          </Text>
        </Pressable>
      )}
    </VStack>
  );
};
