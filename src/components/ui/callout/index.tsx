import { ChevronLeft, ChevronRight, Info, TriangleAlert } from "lucide-react-native";

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
} as const;
export type CalloutTone = (typeof CALLOUT_TONE)[keyof typeof CALLOUT_TONE];

/** Test ids for the parts; a chevron is named by the way it points. */
export const CALLOUT_PART = {
  FRAME: "callout-frame",
  ICON_WARN: "callout-icon-warn",
  ICON_INFO: "callout-icon-info",
  CHEVRON_LEFT: "callout-chevron-left",
  CHEVRON_RIGHT: "callout-chevron-right",
} as const;

/** A warning keeps its edge; a fact sits on the cool tile tint, no line. */
const TONE_LOOK = {
  [CALLOUT_TONE.WARN]: {
    frame: { borderWidth: 1, borderColor: "$warn", backgroundColor: "$surface2" },
    icon: { as: TriangleAlert, color: "$warn", testID: CALLOUT_PART.ICON_WARN },
  },
  [CALLOUT_TONE.INFO]: {
    frame: { backgroundColor: "$tile" },
    icon: { as: Info, color: "$fg", testID: CALLOUT_PART.ICON_INFO },
  },
} as const;

type Props = { body: string; tone?: CalloutTone; action?: StateAction };

/** A note beside working content: what to know, and any way to act on it. */
export const Callout = ({ body, tone = CALLOUT_TONE.WARN, action }: Props) => {
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
        alignItems="flex-start"
        gap="$2"
        accessible
        accessibilityLabel={body}
        accessibilityLiveRegion="polite">
        <Box testID={look.icon.testID}>
          <Icon as={look.icon.as} size="sm" color={look.icon.color} />
        </Box>
        <Text size="sm" color="$fg" flex={1}>
          {body}
        </Text>
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
