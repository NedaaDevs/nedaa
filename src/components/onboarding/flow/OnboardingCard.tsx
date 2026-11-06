import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import type { VStackProps } from "@/components/ui/vstack";

type Props = Pick<
  VStackProps,
  "padding" | "gap" | "testID" | "accessible" | "accessibilityLabel"
> & { children: ReactNode };

/** A step's card over the sky. */
export const OnboardingCard = ({ children, padding = "$4", ...frame }: Props) => (
  <Card padding={padding} {...frame}>
    {children}
  </Card>
);
