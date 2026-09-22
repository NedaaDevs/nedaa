import { styled, View, type GetProps } from "tamagui";

/** A plain surface. Its own frame, so a lint rule can tell it from raw View. */
export const Box = styled(View, {
  name: "Box",

  variants: {
    /** What the gap separates, not how many pixels. `space` is reserved by Tamagui. */
    spacing: {
      tight: { gap: "$tight" },
      inline: { gap: "$inline" },
      stack: { gap: "$stack" },
      group: { gap: "$group" },
      section: { gap: "$section" },
    },
    inset: {
      tight: { padding: "$tight" },
      inline: { padding: "$inline" },
      stack: { padding: "$stack" },
      group: { padding: "$group" },
      section: { padding: "$section" },
    },
  } as const,
});

export type BoxProps = GetProps<typeof Box>;
