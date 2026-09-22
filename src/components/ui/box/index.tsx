import { styled, View, type GetProps } from "tamagui";

/** A plain surface. Its own frame, so a lint rule can tell it from raw View. */
export const Box = styled(View, {
  name: "Box",
});

export type BoxProps = GetProps<typeof Box>;
