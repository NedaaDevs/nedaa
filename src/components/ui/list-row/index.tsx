import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRTL } from "@/contexts/RTLContext";

type Props = {
  icon: IconProps["as"];
  title: string;
  /** Live state, read with the title. */
  status: string;
  hint?: string;
  onPress: () => void;
};

/** A row that leads somewhere: its name, its state now, a chevron onward. */
export const ListRow = ({ icon, title, status, hint, onPress }: Props) => {
  const { isRTL } = useRTL();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${title}, ${status}`}
      accessibilityHint={hint}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      minHeight="$16"
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$card"
      backgroundColor="$surface2">
      <Icon as={icon} size="md" color="$muted" />
      <VStack flex={1}>
        <Text size="sm" bold color="$fg">
          {title}
        </Text>
        <Text size="xs" color="$muted" numberOfLines={1}>
          {status}
        </Text>
      </VStack>
      <Icon as={isRTL ? ChevronLeft : ChevronRight} size="sm" color="$muted" />
    </Pressable>
  );
};
