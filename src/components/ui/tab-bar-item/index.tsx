import { Box } from "@/components/ui/box";
import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

/** Lighter than the icon default, so four glyphs in a row do not read bold. */
const TAB_ICON_STROKE = 1.7;

type Props = {
  label: string;
  icon: IconProps["as"];
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export const TabBarItem = ({ label, icon, selected, onPress, onLongPress }: Props) => {
  const colour = selected ? "$accent" : "$muted";
  return (
    <Pressable
      target="tab"
      role="tab"
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$0.5"
      paddingVertical="$1"
      paddingHorizontal="$0.5"
      borderRadius="$control">
      <Box pointerEvents="none">
        <Icon as={icon} size="xl" color={colour} strokeWidth={TAB_ICON_STROKE} />
      </Box>
      <Text size="sm" fontWeight="600" color={colour} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};
