import type { ReactNode, Ref } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** What a line says: the news, a fact about the change, or why it stopped. */
export const NOTICE_LINE = {
  BODY: "body",
  FACT: "fact",
  REASON: "reason",
} as const;
export type NoticeLineKind = (typeof NOTICE_LINE)[keyof typeof NOTICE_LINE];

export type NoticeLine = { text: string; kind: NoticeLineKind; icon?: IconProps["as"] };

/** Test ids for the parts. */
export const NOTICE_CARD_PART = {
  FRAME: "notice-card-frame",
  GLYPH: "notice-card-glyph",
  TEXT: "notice-card-text",
} as const;

/** A fact reads in the foreground; body and reason recede. */
const LINE_COLOR = {
  [NOTICE_LINE.BODY]: "$muted",
  [NOTICE_LINE.FACT]: "$fg",
  [NOTICE_LINE.REASON]: "$muted",
} as const satisfies Record<NoticeLineKind, string>;

type Copy = { eyebrow?: string; title: string; lines: readonly NoticeLine[] };

/** The eyebrow, title and lines, joined as a screen reader reads the card. */
export const noticeLabel = (t: TFunction, { eyebrow, title, lines }: Copy): string =>
  lines.reduce(
    (said, line) => t("a11y.join", { first: said, second: line.text }),
    eyebrow ? t("a11y.join", { first: eyebrow, second: title }) : title
  );

type Props = {
  icon: IconProps["as"];
  tone: IconTileTone;
  /** A small muted line above the title. */
  eyebrow?: string;
  title: string;
  lines: readonly NoticeLine[];
  /** Lands the reader's focus on the copy after an action. */
  textRef?: Ref<ViewInstance>;
  /** A polite live region, so a change in the copy is spoken. */
  live?: boolean;
  testID?: string;
  /** Actions or other controls, set under the copy. */
  children?: ReactNode;
};

/** A glyph beside a title and its lines, read as one, with room for actions. */
export const NoticeCard = ({
  icon,
  tone,
  eyebrow,
  title,
  lines,
  textRef,
  live = false,
  testID = NOTICE_CARD_PART.FRAME,
  children,
}: Props) => {
  const { t } = useTranslation();
  const label = noticeLabel(t, { eyebrow, title, lines });
  return (
    <Card testID={testID}>
      <HStack gap="$3" alignItems="flex-start">
        <Box
          testID={NOTICE_CARD_PART.GLYPH}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <IconTile icon={icon} tone={tone} />
        </Box>
        <VStack flex={1}>
          <VStack
            ref={textRef}
            testID={NOTICE_CARD_PART.TEXT}
            accessible
            accessibilityLabel={label}
            accessibilityLiveRegion={live ? "polite" : "none"}
            gap="$1.5">
            {eyebrow ? (
              <Text size="sm" color="$muted">
                {eyebrow}
              </Text>
            ) : null}
            <Text size="md" fontWeight="600" color="$fg">
              {title}
            </Text>
            {lines.map((line) => (
              <HStack key={`${line.kind}:${line.text}`} gap="$1.5" alignItems="center">
                {line.icon ? <Icon as={line.icon} size="xs" color={LINE_COLOR[line.kind]} /> : null}
                <Text size="sm" fontWeight="500" color={LINE_COLOR[line.kind]} flexShrink={1}>
                  {line.text}
                </Text>
              </HStack>
            ))}
          </VStack>
          {children ? <Box marginTop="$3.5">{children}</Box> : null}
        </VStack>
      </HStack>
    </Card>
  );
};
