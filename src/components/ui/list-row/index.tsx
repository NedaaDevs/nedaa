import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react-native";

import { HStack, type HStackProps } from "@/components/ui/hstack";
import { Icon, type IconProps, type IconSize } from "@/components/ui/icon";
import { IconTile, TILE_STROKE } from "@/components/ui/icon-tile";
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

/** Each variant's frame and type, shared with rows that pick one of several. */
export const LIST_ROW_STYLE: Record<ListRowVariant, VariantStyle> = {
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
  (
    | {
        onPress: () => void;
        hint?: string;
        /** Names a page outside the app; the row reads as a link and points outward. */
        linkLabel?: string;
      }
    | { onPress?: never; hint?: never; linkLabel?: never }
  );

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
  linkLabel,
  variant = LIST_ROW_VARIANT.CARD,
  onPress,
}: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const style = LIST_ROW_STYLE[variant];
  const leading =
    icon && tile ? (
      <IconTile icon={icon} />
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
      accessibilityRole={linkLabel ? "link" : undefined}
      accessibilityLabel={
        linkLabel ?? (status ? t("a11y.join", { first: title, second: status }) : title)
      }
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
        as={linkLabel ? ExternalLink : isRTL ? ChevronLeft : ChevronRight}
        size="md"
        color="$muted"
        strokeWidth={style.chevronStroke}
      />
    </Pressable>
  );
};
