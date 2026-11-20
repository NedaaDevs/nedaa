import { SpokenStatus } from "@/components/ui/live-region";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ELEVATION_LEVEL } from "@/constants/Elevation";

export const SESSION_DONE_ID = "athkar-session-done";

type Props = {
  message: string;
  /** Says the message aloud; a card that opens finished is read by focus. */
  announce: boolean;
};

/** Every dhikr of the session is counted. */
export const SessionDone = ({ message, announce }: Props) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E2);
  return (
    <VStack
      testID={SESSION_DONE_ID}
      flex={1}
      alignItems="center"
      justifyContent="center"
      marginTop="$3"
      padding="$4"
      borderRadius="$hero"
      backgroundColor="$raised"
      style={{ boxShadow: lift }}>
      <HighlightEdge owner={SESSION_DONE_ID} radius="$hero" />
      <Text size="headline" fontWeight="500" color="$fg" textAlign="center">
        {message}
      </Text>
      <SpokenStatus message={announce ? message : null} />
    </VStack>
  );
};
