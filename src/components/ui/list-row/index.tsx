import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack, type HStackProps } from "@/components/ui/hstack";
import { Icon, type IconProps, type IconSize } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text, type TextProps } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRTL } from "@/contexts/RTLContext";

export const LIST_ROW_VARIANT = {
  /** Stands alone on a screen, drawing its own edge. */
  CARD: "card",
  /** A row inside a panel or sheet that draws the edge for it. */
  PLAIN: "plain",
  /** A row in a list group, which draws the edge and the rules between. */
  GROUPED: "grouped",
} as const;
export type ListRowVariant = (typeof LIST_ROW_VARIANT)[keyof typeof LIST_ROW_VARIANT];

/** Test ids for the row's parts. */
export const LIST_ROW_PART = { TILE: "list-row-tile" } as const;

/** The tinted tile's side, from the Settings design; no size token is 38. */
const TILE_SIZE = 38;
const TILE_STROKE = 1.75;

type VariantStyle = {
  frame: Pick<
    HStackProps,
    | "minHeight"
    | "paddingHorizontal"
    | "paddingVertical"
    | "borderWidth"
    | "borderColor"
    | "borderRadius"
    | "backgroundColor"
  >;
  title: Pick<TextProps, "size" | "bold" | "fontWeight" | "typography">;
  status: Pick<TextProps, "size" | "fontWeight" | "typography">;
  icon: IconSize;
  chevronStroke?: number;
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
    status: { size: "xs" },
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
    status: { size: "xs" },
    icon: "lg",
  },
  [LIST_ROW_VARIANT.GROUPED]: {
    frame: {
      minHeight: "$16",
      paddingHorizontal: "$3",
      paddingVertical: "$2.5",
      backgroundColor: "transparent",
    },
    title: { size: "md", bold: true, typography: "title" },
    status: { size: "sm", fontWeight: "500", typography: "helper" },
    icon: "lg",
    chevronStroke: TILE_STROKE,
  },
};

type BaseProps = {
  icon?: IconProps["as"];
  /** Sets the icon in the accent on a tinted tile; bare and muted otherwise. */
  tile?: boolean;
  title: string;
  /** Live state, read with the title; on a static row, the full text. */
  status?: string;
  variant?: ListRowVariant;
};

/** A row with an action leads somewhere; one without states a fact. */
type Props = BaseProps &
  ({ onPress: () => void; hint?: string } | { onPress?: never; hint?: never });

/**
 * With `onPress`: a button with its name, its state now and a chevron onward.
 * Without: a statement headed by its title, the text in full, nothing to press.
 */
export const ListRow = ({
  icon,
  tile = false,
  title,
  status,
  hint,
  variant = LIST_ROW_VARIANT.CARD,
  onPress,
}: Props) => {
  const { isRTL } = useRTL();
  const style = VARIANT_STYLE[variant];
  const leading =
    icon && tile ? (
      <Box
        testID={LIST_ROW_PART.TILE}
        width={TILE_SIZE}
        height={TILE_SIZE}
        borderRadius="$control"
        backgroundColor="$tile"
        alignItems="center"
        justifyContent="center">
        <Icon as={icon} size="lg" color="$accent" strokeWidth={TILE_STROKE} />
      </Box>
    ) : icon ? (
      <Icon as={icon} size={style.icon} color="$muted" />
    ) : null;

  if (!onPress) {
    return (
      <HStack alignItems="flex-start" gap="$3" {...style.frame}>
        {leading}
        <VStack flex={1}>
          <Text {...style.title} color="$fg" accessibilityRole="header">
            {title}
          </Text>
          {status ? (
            <Text {...style.status} color="$muted">
              {status}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={status ? `${title}, ${status}` : title}
      accessibilityHint={hint}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...style.frame}>
      {leading}
      <VStack flex={1}>
        <Text {...style.title} color="$fg">
          {title}
        </Text>
        {status ? (
          <Text {...style.status} color="$muted" numberOfLines={1}>
            {status}
          </Text>
        ) : null}
      </VStack>
      <Icon
        as={isRTL ? ChevronLeft : ChevronRight}
        size="md"
        color="$muted"
        strokeWidth={style.chevronStroke}
      />
    </Pressable>
  );
};
