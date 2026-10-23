import { createContext } from "react";
import { styled } from "tamagui";

import { VStack } from "@/components/ui/vstack";

/** A screen's side gutter, shared by its header and its content column. */
export const SCREEN_GUTTER = "$screen";

/** The gutter of a screen off the sky, which pads its content by hand. */
const GROUP_GUTTER = "$group";

/** The gutter a screen header takes; a sky screen sets the screen gutter. */
export const ScreenGutterContext = createContext<typeof SCREEN_GUTTER | typeof GROUP_GUTTER>(
  GROUP_GUTTER
);

/** A screen's content column, inset by the screen gutter. */
export const ScreenContent = styled(VStack, {
  name: "ScreenContent",
  paddingHorizontal: SCREEN_GUTTER,
});
