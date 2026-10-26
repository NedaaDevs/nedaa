import type { Ref } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack, type HStackProps } from "@/components/ui/hstack";
import { Icon, type IconProps, type IconSize } from "@/components/ui/icon";
import { IconTile, TILE_STROKE } from "@/components/ui/icon-tile";
import { useRestingSurface } from "@/components/ui/material/edge";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
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
    "minHeight" | "paddingHorizontal" | "paddingVertical" | "borderRadius" | "backgroundColor"
  >;
  /** The pressed look; unset keeps the pressable's own dim. */
  press?: Pick<HStackProps, "backgroundColor" | "opacity">;
  /** Draws the resting lift and lit edge of a card, which shrinks when pressed. */
  rests?: boolean;
  title: Pick<TextProps, "size" | "bold" | "fontWeight" | "typography">;
  status: Pick<TextProps, "size" | "fontWeight" | "typography">;
  icon: IconSize;
  chevronStroke?: number;
  /** The chevron's opacity; unset draws it at full. */
  chevronOpacity?: number;
};

/** Test ids for the row's parts. */
export const LIST_ROW_PART = { CHEVRON: "list-row-chevron" } as const;

/** A list row's name and state: the name at 16/600, the state at 13/500. */
const ROW_TITLE = { size: "lg", fontWeight: "600", typography: "title" } as const;
const ROW_STATUS = { size: "helper", fontWeight: "500", typography: "helper" } as const;
/** The chevron recedes behind the row's text. */
const CHEVRON_QUIET = 0.7;

/** Each variant's frame and type, shared with rows that pick one of several. */
export const LIST_ROW_STYLE: Record<ListRowVariant, VariantStyle> = {
  [LIST_ROW_VARIANT.CARD]: {
    frame: {
      minHeight: "$14",
      paddingHorizontal: "$3.5",
      paddingVertical: "$2.5",
      borderRadius: "$card",
      backgroundColor: "$surfaceGlass",
    },
    rests: true,
    title: ROW_TITLE,
    status: ROW_STATUS,
    icon: "md",
    chevronOpacity: CHEVRON_QUIET,
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
      minHeight: "$14",
      paddingHorizontal: "$3.5",
      paddingVertical: "$2.5",
      backgroundColor: "transparent",
    },
    press: { backgroundColor: "$pressed", opacity: 1 },
    title: ROW_TITLE,
    status: ROW_STATUS,
    icon: "lg",
    chevronStroke: TILE_STROKE,
    chevronOpacity: CHEVRON_QUIET,
  },
};

type BaseProps = {
  icon?: IconProps["as"];
  /** Sets the icon in the accent on a tinted tile; bare and muted otherwise. */
  tile?: boolean;
  title: string;
  /** Live state, read with the title; on a static row, the full text. */
  status?: string;
  /** The status as spoken, where its signs would not read aloud. */
  spokenStatus?: string;
  variant?: ListRowVariant;
};

/** A row with an action leads somewhere; one without states a fact. */
type Props = BaseProps &
  (
    | {
        onPress: () => void;
        hint?: string;
        /** Holds the row still, such as while the value it opens is saved. */
        disabled?: boolean;
        /** The row's view, so a sheet it opens can hand focus back to it. */
        ref?: Ref<ViewInstance>;
        /** Names a page outside the app; the row reads as a link and points outward. */
        linkLabel?: string;
        /** The row's test id, where a flow presses it. */
        testID?: string;
        /** The status explains the row, not a live value, so it wraps. */
        wrapStatus?: boolean;
      }
    | {
        onPress?: never;
        hint?: never;
        linkLabel?: never;
        disabled?: never;
        ref?: never;
        testID?: never;
        wrapStatus?: never;
      }
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
  spokenStatus,
  hint,
  linkLabel,
  variant = LIST_ROW_VARIANT.CARD,
  onPress,
  disabled,
  ref,
  testID,
  wrapStatus = false,
}: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const style = LIST_ROW_STYLE[variant];
  const resting = useRestingSurface({ radius: style.frame.borderRadius });
  const lift = style.rests ? resting.lift : undefined;
  const edge = style.rests ? resting.edge : null;
  const scale = usePressScale();
  const leading =
    icon && tile ? (
      <IconTile icon={icon} />
    ) : icon ? (
      <Icon as={icon} size={style.icon} color="$muted" />
    ) : null;

  if (!onPress) {
    return (
      <HStack alignItems="flex-start" gap="$3" {...style.frame} style={lift}>
        {edge}
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
      ref={ref}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={linkLabel ? "link" : undefined}
      accessibilityLabel={
        linkLabel ??
        (status ? t("a11y.join", { first: title, second: spokenStatus ?? status }) : title)
      }
      accessibilityHint={hint}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...style.frame}
      {...(style.press && { pressStyle: style.press })}
      {...(style.rests && scale)}
      style={lift}>
      {edge}
      {leading}
      <VStack flex={1}>
        <Text {...style.title} color="$fg">
          {title}
        </Text>
        {status ? (
          <Text {...style.status} color="$muted" numberOfLines={wrapStatus ? undefined : 1}>
            {status}
          </Text>
        ) : null}
      </VStack>
      <Box testID={LIST_ROW_PART.CHEVRON} opacity={style.chevronOpacity}>
        <Icon
          as={linkLabel ? ExternalLink : isRTL ? ChevronLeft : ChevronRight}
          size="md"
          color="$muted"
          strokeWidth={style.chevronStroke}
        />
      </Box>
    </Pressable>
  );
};
