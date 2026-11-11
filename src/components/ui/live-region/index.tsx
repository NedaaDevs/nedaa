import { useState, type ComponentProps } from "react";
import { Platform } from "react-native";

import { Box } from "@/components/ui/box";
import { PlatformType } from "@/enums/app";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";

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

type SpokenStatusProps = {
  /** What VoiceOver and TalkBack say as it changes; null says nothing. */
  message: string | null;
  testID?: string;
};

/** Says each message and draws nothing; keep it mounted while it can change. */
export const SpokenStatus = ({ message, testID }: SpokenStatusProps) => {
  useIosAnnouncement(message);
  return Platform.OS === PlatformType.ANDROID ? (
    <LiveRegion
      testID={testID}
      message={message}
      position="absolute"
      bottom={0}
      width="$0.5"
      height="$0.5"
      pointerEvents="none"
    />
  ) : null;
};
