import { Image } from "react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useIsDarkTheme } from "@/components/ui/theme-color";
import { VStack } from "@/components/ui/vstack";

/** Test ids for the parts the theme changes. */
export const ABOUT_BRAND_PART = { ICON: "about-brand-icon" } as const;

// The same icons the home screen shows in each appearance.
const APP_ICON = require("@/../assets/images/icon.png");
const APP_ICON_DARK = require("@/../assets/images/ios-dark.png");

/** The app's icon, name and line; read as one element. */
export const AboutBrand = () => {
  const { t } = useTranslation();
  const name = t("brand.name");
  const tagline = t("settings.about.tagline");
  const dark = useIsDarkTheme();
  return (
    <VStack
      accessible
      accessibilityLabel={`${name}, ${tagline}`}
      alignItems="center"
      gap="$2"
      paddingVertical="$5"
      paddingHorizontal="$3.5"
      borderWidth={1}
      borderColor="$accentLine"
      borderRadius="$sheet"
      backgroundColor="$surface2">
      <Box
        width="$14"
        height="$14"
        borderWidth={1}
        borderColor="$accentLine"
        borderRadius="$sheet"
        overflow="hidden">
        <Image
          testID={ABOUT_BRAND_PART.ICON}
          source={dark ? APP_ICON_DARK : APP_ICON}
          style={{ width: "100%", height: "100%" }}
        />
      </Box>
      <VStack alignItems="center">
        <Text size="xl" bold typography="title" color="$fg">
          {name}
        </Text>
        <Text size="sm" typography="helper" color="$muted" textAlign="center">
          {tagline}
        </Text>
      </VStack>
    </VStack>
  );
};
