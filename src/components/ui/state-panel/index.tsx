import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { CircleAlert, Clock, Hourglass, Info, type LucideIcon } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  STATE_PANEL_KIND,
  STATE_PANEL_VARIANT,
  type StatePanelKind,
  type StatePanelVariant,
} from "@/constants/StatePanel";
import { PlatformType } from "@/enums/app";

/** What a panel or callout offers: a labelled press, hinted when unclear. */
export type StateAction = { label: string; hint?: string; onPress: () => void };

/** Test id for the panel's outer frame. */
export const STATE_PANEL_ROOT_ID = "state-panel-root";

/** Test ids for each kind's icon. */
export const STATE_PANEL_ICON_ID: Record<StatePanelKind, string> = {
  [STATE_PANEL_KIND.LOADING]: "state-panel-icon-loading",
  [STATE_PANEL_KIND.UNAVAILABLE]: "state-panel-icon-unavailable",
  [STATE_PANEL_KIND.ERROR]: "state-panel-icon-error",
};

type KindIcon = { icon: LucideIcon; color: string };

// Static icons: a wait never spins, so Reduce Motion has nothing to stop.
// On a sheet all are amber: time for a wait or a gap, info for a failure.
const KIND_ICON: Record<StatePanelVariant, Record<StatePanelKind, KindIcon>> = {
  [STATE_PANEL_VARIANT.CARD]: {
    [STATE_PANEL_KIND.LOADING]: { icon: Hourglass, color: "$muted" },
    [STATE_PANEL_KIND.UNAVAILABLE]: { icon: Clock, color: "$warn" },
    [STATE_PANEL_KIND.ERROR]: { icon: CircleAlert, color: "$danger" },
  },
  [STATE_PANEL_VARIANT.FLAT]: {
    [STATE_PANEL_KIND.LOADING]: { icon: Clock, color: "$warn" },
    [STATE_PANEL_KIND.UNAVAILABLE]: { icon: Clock, color: "$warn" },
    [STATE_PANEL_KIND.ERROR]: { icon: Info, color: "$warn" },
  },
};

// No size token fits: about 28 characters of body copy per line.
const FLAT_BODY_MAX_WIDTH = 200;

// The frame and type scale for each variant; the flat one sits on a sheet.
const LOOK = {
  [STATE_PANEL_VARIANT.CARD]: {
    frame: {
      paddingVertical: "$5",
      paddingHorizontal: "$4",
      borderWidth: 1,
      borderColor: "$border",
      borderRadius: "$sheet",
      backgroundColor: "$surface2",
    },
    icon: { size: "lg" },
    iconGap: undefined,
    title: { size: "md" },
    body: {},
  },
  [STATE_PANEL_VARIANT.FLAT]: {
    frame: { paddingTop: "$8", paddingBottom: "$10", paddingHorizontal: "$1" },
    icon: { size: "2xl", strokeWidth: 1.65 },
    iconGap: "$0.5",
    title: { size: "lg", typography: "display" },
    body: { typography: "helper", maxWidth: FLAT_BODY_MAX_WIDTH },
  },
} as const;

type Props = {
  title: string;
  body: string;
  kind?: StatePanelKind;
  /** A card on a screen; flat on a sheet's own surface. */
  variant?: StatePanelVariant;
  /** The way on; a wait has none. */
  action?: StateAction;
};

/** A state in place of content: what is happening, and the way on. */
export const StatePanel = ({
  title,
  body,
  kind = STATE_PANEL_KIND.ERROR,
  variant = STATE_PANEL_VARIANT.CARD,
  action,
}: Props) => {
  const message = `${title}. ${body}`;
  const { icon, color } = KIND_ICON[variant][kind];
  const look = LOOK[variant];

  // Android speaks the live region below; iOS has no live regions.
  useEffect(() => {
    if (Platform.OS === PlatformType.IOS) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <VStack testID={STATE_PANEL_ROOT_ID} alignItems="center" gap="$1.5" {...look.frame}>
      {/* One announced message; the action stays reachable beside it. */}
      <VStack
        alignItems="center"
        gap="$1.5"
        accessible
        accessibilityLabel={message}
        accessibilityLiveRegion="polite">
        <Box testID={STATE_PANEL_ICON_ID[kind]} marginBottom={look.iconGap}>
          <Icon as={icon} color={color} {...look.icon} />
        </Box>
        <Text bold color="$fg" textAlign="center" {...look.title}>
          {title}
        </Text>
        <Text size="sm" color="$muted" textAlign="center" {...look.body}>
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
