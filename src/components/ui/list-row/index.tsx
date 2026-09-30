import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Icon, type IconProps, type IconSize } from "@/components/ui/icon";
import { Pressable, type PressableProps } from "@/components/ui/pressable";
import { Text, type TextProps } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRTL } from "@/contexts/RTLContext";

export const LIST_ROW_VARIANT = {
  /** Stands alone on a screen, drawing its own edge. */
  CARD: "card",
  /** A row inside a panel or sheet that draws the edge for it. */
  PLAIN: "plain",
} as const;
export type ListRowVariant = (typeof LIST_ROW_VARIANT)[keyof typeof LIST_ROW_VARIANT];

type VariantStyle = {
  frame: PressableProps;
  title: Pick<TextProps, "size" | "bold" | "fontWeight">;
  icon: IconSize;
};

const VARIANT_STYLE: Record<ListRowVariant, VariantStyle> = {
  [LIST_ROW_VARIANT.CARD]: {
    frame: {
      minHeight: "$16",
      paddingHorizontal: "$3",
      paddingVertical: "$2.5",
      borderWidth: 1,
      borderColor: "$border",
      borderRadius: "$card",
      backgroundColor: "$surface2",
    },
    title: { size: "sm", bold: true },
    icon: "md",
  },
  [LIST_ROW_VARIANT.PLAIN]: {
    frame: {
      minHeight: "$14",
      paddingHorizontal: "$1",
      paddingVertical: "$1.5",
      backgroundColor: "transparent",
    },
    title: { size: "md", fontWeight: "600" },
    icon: "lg",
  },
};

type Props = {
  icon?: IconProps["as"];
  title: string;
  /** Live state, read with the title. */
  status: string;
  hint?: string;
  variant?: ListRowVariant;
  onPress: () => void;
};

/** A row that leads somewhere: its name, its state now, a chevron onward. */
export const ListRow = ({
  icon,
  title,
  status,
  hint,
  variant = LIST_ROW_VARIANT.CARD,
  onPress,
}: Props) => {
  const { isRTL } = useRTL();
  const style = VARIANT_STYLE[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${title}, ${status}`}
      accessibilityHint={hint}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...style.frame}>
      {icon ? <Icon as={icon} size={style.icon} color="$muted" /> : null}
      <VStack flex={1}>
        <Text {...style.title} color="$fg">
          {title}
        </Text>
        <Text size="xs" color="$muted" numberOfLines={1}>
          {status}
        </Text>
      </VStack>
      <Icon as={isRTL ? ChevronLeft : ChevronRight} size="md" color="$muted" />
    </Pressable>
  );
};
