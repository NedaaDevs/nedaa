import type { ComponentProps } from "react";

import { Box } from "@/components/ui/box";

type Props = Omit<
  ComponentProps<typeof Box>,
  "accessible" | "accessibilityLabel" | "accessibilityLiveRegion" | "importantForAccessibility"
> & {
  /** What TalkBack says as it changes; null keeps the region silent. */
  message: string | null;
};

// TalkBack reads it each time its message changes; keep it mounted while that
// can happen, since Android speaks only for an attached view.
export const LiveRegion = ({ message, ...rest }: Props) => (
  <Box
    {...rest}
    // "yes" keeps a label change on AOSP's live-region path; "" clears it.
    importantForAccessibility="yes"
    accessible={message !== null}
    accessibilityLabel={message ?? ""}
    accessibilityLiveRegion="polite"
  />
);
