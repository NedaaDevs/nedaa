import { styled, YStack, type GetProps } from "tamagui";

/** A column. Its own frame, so a lint rule can tell it from raw YStack. */
export const VStack = styled(YStack, {
  name: "VStack",

  variants: {
    /** What the gap separates, not how many pixels. `space` is reserved by Tamagui. */
    spacing: {
      tight: { gap: "$tight" },
      inline: { gap: "$inline" },
      stack: { gap: "$stack" },
      group: { gap: "$group" },
      section: { gap: "$section" },
    },
    /** Padding by the same steps. `inset` is a Tamagui style prop. */
    pad: {
      tight: { padding: "$tight" },
      inline: { padding: "$inline" },
      stack: { padding: "$stack" },
      group: { padding: "$group" },
      section: { padding: "$section" },
    },
  } as const,
});

export type VStackProps = GetProps<typeof VStack>;
