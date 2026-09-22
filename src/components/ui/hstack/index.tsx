import { styled, XStack, type GetProps } from "tamagui";

/** A row. Its own frame, so a lint rule can tell it from raw XStack. */
export const HStack = styled(XStack, {
  name: "HStack",
});

export type HStackProps = GetProps<typeof HStack>;
