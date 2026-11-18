import type { ReactNode } from "react";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { SECTION_KIND, type SectionKind } from "@/constants/Section";
import type { LayoutFocus } from "@/utils/layoutFocus";

/** The label's ink: the full ink set back, not a muted colour. */
export const SECTION_LABEL_INK = 0.78;

/** Test ids for the section's parts. */
export const SECTION_PART = { FRAME: "section-frame", HEAD: "section-head" } as const;

type SectionProps = {
  title: string;
  /** Drawn at the end of the title line, outside the header. */
  accessory?: ReactNode;
  kind?: SectionKind;
  /** Reader focus for the title, sent once it is laid out. */
  titleFocus?: LayoutFocus;
  children: ReactNode;
};

/** A titled group of a screen: the title is a header the reader can jump to. */
export const Section = ({
  title,
  accessory,
  kind = SECTION_KIND.TITLE,
  titleFocus,
  children,
}: SectionProps) => {
  const label = kind === SECTION_KIND.LABEL;
  const focus = { ref: titleFocus?.ref, onLayout: titleFocus?.onLayout };
  return (
    <VStack testID={SECTION_PART.FRAME} gap={label ? "$2.5" : "$2"}>
      <HStack
        testID={SECTION_PART.HEAD}
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        paddingHorizontal={label ? "$1" : undefined}>
        {label ? (
          <Text
            size="label"
            fontWeight="600"
            color="$fg"
            opacity={SECTION_LABEL_INK}
            accessibilityRole="header"
            flexShrink={1}
            {...focus}>
            {title}
          </Text>
        ) : (
          <Text
            size="lg"
            bold
            typography="display"
            color="$fg"
            accessibilityRole="header"
            flexShrink={1}
            {...focus}>
            {title}
          </Text>
        )}
        {accessory}
      </HStack>
      {children}
    </VStack>
  );
};
