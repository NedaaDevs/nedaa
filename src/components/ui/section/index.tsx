import type { ReactNode } from "react";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** A titled group of a screen: the title is a header the reader can jump to. */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <VStack gap="$2.5">
    <Text size="md" bold color="$fg" accessibilityRole="header">
      {title}
    </Text>
    {children}
  </VStack>
);
