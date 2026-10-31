import { useState, type ComponentProps } from "react";

import { Box } from "@/components/ui/box";

type Props = Omit<
  ComponentProps<typeof Box>,
  | "accessible"
  | "accessibilityLabel"
  | "accessibilityLiveRegion"
  | "importantForAccessibility"
  | "onLayout"
> & {
  /** What TalkBack says as it changes; null keeps the region silent. */
  message: string | null;
};

// TalkBack reads it each time its message changes; keep it mounted while that
// can happen, since Android speaks only for an attached view.
export const LiveRegion = ({ message, ...rest }: Props) => {
  // A message it mounts with goes in the commit after its first layout.
  const [laidOut, setLaidOut] = useState(false);
  const said = laidOut ? message : null;
  return (
    <Box
      {...rest}
      onLayout={() => setLaidOut(true)}
      // "yes" keeps a label change on AOSP's live-region path; "" clears it.
      importantForAccessibility="yes"
      accessible={said !== null}
      accessibilityLabel={said ?? ""}
      accessibilityLiveRegion="polite"
    />
  );
};
