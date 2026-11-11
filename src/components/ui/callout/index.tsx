import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Info, MapPin, TriangleAlert } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import type { StateAction } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRTL } from "@/contexts/RTLContext";

export const CALLOUT_TONE = {
  /** Something is off, such as times for a place that is not the user's. */
  WARN: "warn",
  /** A calm fact about what is shown, such as where a place came from. */
  INFO: "info",
  /** A place found for what was entered, such as the nearest city. */
  PLACE: "place",
  /** Something failed, such as a download that stopped. */
  DANGER: "danger",
} as const;
export type CalloutTone = (typeof CALLOUT_TONE)[keyof typeof CALLOUT_TONE];

/** Test ids for the parts; a chevron is named by the way it points. */
export const CALLOUT_PART = {
  FRAME: "callout-frame",
  ICON_WARN: "callout-icon-warn",
  ICON_INFO: "callout-icon-info",
  ICON_PLACE: "callout-icon-place",
  ICON_DANGER: "callout-icon-danger",
  CHEVRON_LEFT: "callout-chevron-left",
  CHEVRON_RIGHT: "callout-chevron-right",
} as const;

/** A warning keeps its edge; a fact sits on the cool tile tint, no line. */
const TONE_LOOK = {
  [CALLOUT_TONE.WARN]: {
    frame: { borderWidth: 1, borderColor: "$warn", backgroundColor: "$surface2" },
    row: { alignItems: "flex-start" },
    icon: { as: TriangleAlert, color: "$warn", size: "sm", testID: CALLOUT_PART.ICON_WARN },
    text: { color: "$fg" },
  },
  [CALLOUT_TONE.INFO]: {
    frame: { backgroundColor: "$tile" },
    row: { alignItems: "flex-start" },
    icon: { as: Info, color: "$fg", size: "sm", testID: CALLOUT_PART.ICON_INFO },
    text: { color: "$fg" },
  },
  [CALLOUT_TONE.PLACE]: {
    frame: { backgroundColor: "$tile" },
    row: { alignItems: "flex-start" },
    icon: { as: MapPin, color: "$fg", size: "sm", testID: CALLOUT_PART.ICON_PLACE },
    text: { color: "$fg" },
  },
  // A failure in its own colour: a control-sized box, the sign centred.
  [CALLOUT_TONE.DANGER]: {
    frame: {
      borderWidth: 1,
      borderColor: "$dangerEdge",
      backgroundColor: "$dangerTint",
      borderRadius: "$control",
    },
    row: { alignItems: "center" },
    icon: { as: TriangleAlert, color: "$danger", size: "md", testID: CALLOUT_PART.ICON_DANGER },
    text: { color: "$danger", fontWeight: "600" },
  },
} as const;

type Props = {
  /** A lead line over the body, such as the place found. */
  title?: string;
  body: string;
  tone?: CalloutTone;
  action?: StateAction;
  /** Off where the host says the note itself, once it has settled. */
  live?: boolean;
};

/** A note beside working content: what to know, and any way to act on it. */
export const Callout = ({ title, body, tone = CALLOUT_TONE.WARN, action, live = true }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const look = TONE_LOOK[tone];
  return (
    <VStack
      testID={CALLOUT_PART.FRAME}
      gap="$1"
      paddingTop="$3"
      paddingBottom={action ? undefined : "$3"}
      paddingHorizontal="$3"
      borderRadius="$card"
      {...look.frame}>
      <HStack
        {...look.row}
        gap="$2"
        accessible
        accessibilityLabel={title ? t("a11y.join", { first: title, second: body }) : body}
        accessibilityLiveRegion={live ? "polite" : "none"}>
        <Box testID={look.icon.testID}>
          <Icon as={look.icon.as} size={look.icon.size} color={look.icon.color} />
        </Box>
        <VStack flex={1}>
          {title ? (
            <Text size="sm" bold color={look.text.color}>
              {title}
            </Text>
          ) : null}
          <Text size="sm" {...look.text}>
            {body}
          </Text>
        </VStack>
      </HStack>
      {/* An underline crosses Arabic dots; a chevron marks the action instead. */}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityLabel={action.label}
          accessibilityHint={action.hint}
          alignSelf="flex-start"
          flexDirection="row"
          alignItems="center"
          gap="$1">
          <Text size="sm" fontWeight="600" color="$accentText">
            {action.label}
          </Text>
          <Box testID={isRTL ? CALLOUT_PART.CHEVRON_LEFT : CALLOUT_PART.CHEVRON_RIGHT}>
            <Icon as={isRTL ? ChevronLeft : ChevronRight} size="xs" color="$accentText" />
          </Box>
        </Pressable>
      ) : null}
    </VStack>
  );
};
