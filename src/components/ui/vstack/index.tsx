import { styled, YStack, type GetProps } from "tamagui";

/** A column. Its own frame, so a lint rule can tell it from raw YStack. */
export const VStack = styled(YStack, {
  name: "VStack",
});

export type VStackProps = GetProps<typeof VStack>;
