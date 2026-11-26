import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useRTL } from "@/contexts/RTLContext";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type Props = {
  onPress: () => void;
  /** What a reader says; the caller translates it. */
  label: string;
  /** The destination's name, shown beside the arrow. */
  name?: string;
};

/** A back arrow pointing to the start edge, with the place it returns to. */
export const BackLink = ({ onPress, label, name }: Props) => {
  const { isRTL } = useRTL();
  const Chevron = isRTL ? ChevronRight : ChevronLeft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      flexDirection="row"
      alignItems="center"
      gap="$0.5"
      // The chevron's side bearing hangs outside the title's column.
      marginStart="$-1.5">
      <Icon as={Chevron} size="lg" color="$accentText" />
      {name && (
        <Text size="label" fontWeight="600" color="$accentText">
          {name}
        </Text>
      )}
    </Pressable>
  );
};
