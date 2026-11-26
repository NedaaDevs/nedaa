import type { ComponentProps } from "react";

import { Text } from "@/components/ui/text";

type SessionFiguresProps = {
  figures: string;
} & Pick<ComponentProps<typeof Text>, "textAlign" | "pointerEvents">;

/** The session's place in figures, as the reader and Focus write it. */
export const SessionFigures = ({ figures, ...props }: SessionFiguresProps) => (
  <Text size="label" fontWeight="500" color="$mutedSky" numeric {...props}>
    {figures}
  </Text>
);
