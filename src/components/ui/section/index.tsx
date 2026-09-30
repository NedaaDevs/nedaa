import type { ReactNode } from "react";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { SECTION_KIND, type SectionKind } from "@/constants/Section";

type SectionProps = {
  title: string;
  /** Drawn at the end of the title line, outside the header. */
  accessory?: ReactNode;
  kind?: SectionKind;
  children: ReactNode;
};

/** A titled group of a screen: the title is a header the reader can jump to. */
export const Section = ({
  title,
  accessory,
  kind = SECTION_KIND.TITLE,
  children,
}: SectionProps) => (
  <VStack gap={kind === SECTION_KIND.LABEL ? "$1.5" : "$2"}>
    <HStack alignItems="center" justifyContent="space-between" gap="$2">
      <Text
        size={kind === SECTION_KIND.LABEL ? "sm" : "lg"}
        bold
        typography={kind === SECTION_KIND.LABEL ? "helper" : "display"}
        color={kind === SECTION_KIND.LABEL ? "$muted" : "$fg"}
        accessibilityRole="header"
        flexShrink={1}>
        {title}
      </Text>
      {accessory}
    </HStack>
    {children}
  </VStack>
);
