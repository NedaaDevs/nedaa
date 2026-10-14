import { Image, type ImageProps } from "react-native";

import { Box, type BoxProps } from "@/components/ui/box";
import { useIsDarkTheme } from "@/components/ui/theme-color";

/** Test id for the icon's tile. */
export const BRAND_ICON_FRAME = "brand-icon-frame";

// The same icons the home screen shows in each appearance.
const APP_ICON = require("@/../assets/images/icon.png");
const APP_ICON_DARK = require("@/../assets/images/ios-dark.png");

const FILL = { width: "100%", height: "100%" } as const;

type Props = {
  /** The tile's side, a size token. */
  size: BoxProps["width"];
  /** Test id for the image. */
  testID?: ImageProps["testID"];
};

/** The app's icon in the theme's variant; the caller names it for readers. */
export const BrandIcon = ({ size, testID }: Props) => {
  const dark = useIsDarkTheme();
  return (
    <Box
      testID={BRAND_ICON_FRAME}
      width={size}
      height={size}
      borderWidth={1}
      borderColor="$accentLine"
      borderRadius="$sheet"
      overflow="hidden">
      <Image
        testID={testID}
        source={dark ? APP_ICON_DARK : APP_ICON}
        style={FILL}
        accessible={false}
      />
    </Box>
  );
};
