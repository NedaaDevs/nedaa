import type { ReactNode } from "react";

import { VStack, type VStackProps } from "@/components/ui/vstack";

type Props = Pick<
  VStackProps,
  "padding" | "gap" | "testID" | "accessible" | "accessibilityLabel"
> & { children: ReactNode };

/** A step's bordered card over the sky. */
export const OnboardingCard = ({ children, padding = "$4", ...frame }: Props) => (
  <VStack
    padding={padding}
    borderRadius="$card"
    borderWidth={1}
    borderColor="$border"
    backgroundColor="$surface2"
    {...frame}>
    {children}
  </VStack>
);
