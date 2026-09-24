import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import type { StateAction } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRTL } from "@/contexts/RTLContext";

/** Test ids for the action's chevron, named by the way it points. */
export const CALLOUT_PART = {
  CHEVRON_LEFT: "callout-chevron-left",
  CHEVRON_RIGHT: "callout-chevron-right",
} as const;

type Props = { body: string; action: StateAction };

/** A warning beside working content: what to know, and what to do about it. */
export const Callout = ({ body, action }: Props) => {
  const { isRTL } = useRTL();
  return (
    <VStack
      gap="$1"
      paddingTop="$3"
      paddingHorizontal="$3"
      borderWidth={1}
      borderColor="$warn"
      borderRadius="$card"
      backgroundColor="$surface2">
      <HStack
        alignItems="flex-start"
        gap="$2"
        accessible
        accessibilityLabel={body}
        accessibilityLiveRegion="polite">
        <Icon as={TriangleAlert} size="sm" color="$warn" />
        <Text size="sm" color="$fg" flex={1}>
          {body}
        </Text>
      </HStack>
      {/* An underline crosses Arabic dots; a chevron marks the action instead. */}
      <Pressable
        onPress={action.onPress}
        accessibilityLabel={action.label}
        accessibilityHint={action.hint}
        alignSelf="flex-start"
        flexDirection="row"
        alignItems="center"
        gap="$1">
        <Text size="sm" fontWeight="600" color="$accent">
          {action.label}
        </Text>
        <Box testID={isRTL ? CALLOUT_PART.CHEVRON_LEFT : CALLOUT_PART.CHEVRON_RIGHT}>
          <Icon as={isRTL ? ChevronLeft : ChevronRight} size="xs" color="$accent" />
        </Box>
      </Pressable>
    </VStack>
  );
};
