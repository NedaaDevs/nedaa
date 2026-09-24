import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type Props = { icon: IconProps["as"]; label: string; hint?: string; onPress: () => void };

/** A tool to open: its icon at the top start, its name at the bottom start. */
export const Tile = ({ icon, label, hint, onPress }: Props) => (
  <Pressable
    onPress={onPress}
    accessibilityLabel={label}
    accessibilityHint={hint}
    minHeight="$20"
    padding="$3"
    gap="$2"
    // Both at the start edge, where the eye begins in either direction.
    flexDirection="column"
    alignItems="flex-start"
    justifyContent="space-between"
    borderWidth={1}
    borderColor="$border"
    borderRadius="$card"
    backgroundColor="$surface2">
    <Icon as={icon} size="lg" color="$muted" />
    <Text size="sm" fontWeight="600" color="$fg">
      {label}
    </Text>
  </Pressable>
);
