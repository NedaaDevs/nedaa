import { styled, XStack, type GetProps } from "tamagui";

/** A row. Its own frame, so a lint rule can tell it from raw XStack. */
export const HStack = styled(XStack, {
  name: "HStack",

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

export type HStackProps = GetProps<typeof HStack>;
