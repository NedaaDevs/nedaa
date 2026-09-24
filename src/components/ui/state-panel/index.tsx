import { CircleAlert } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** What a panel or callout offers: a labelled press, with a hint when unclear. */
export type StateAction = { label: string; hint?: string; onPress: () => void };

type Props = { title: string; body: string; action: StateAction };

/** A failure in place of content: what went wrong, and the way on. */
export const StatePanel = ({ title, body, action }: Props) => (
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
      accessibilityLabel={`${title}. ${body}`}
      accessibilityLiveRegion="polite">
      <Icon as={CircleAlert} size="lg" color="$danger" />
      <Text size="md" bold color="$fg" textAlign="center">
        {title}
      </Text>
      <Text size="sm" color="$muted" textAlign="center">
        {body}
      </Text>
    </VStack>
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
  </VStack>
);
