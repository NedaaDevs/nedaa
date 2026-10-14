import { useTranslation } from "react-i18next";

import { BrandIcon } from "@/components/ui/brand-icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** Test ids for the parts the theme changes. */
export const ABOUT_BRAND_PART = { ICON: "about-brand-icon" } as const;

/** The app's icon, name and line; read as one element. */
export const AboutBrand = () => {
  const { t } = useTranslation();
  const name = t("brand.name");
  const tagline = t("settings.about.tagline");
  return (
    <VStack
      accessible
      accessibilityLabel={t("a11y.join", { first: name, second: tagline })}
      alignItems="center"
      gap="$2"
      paddingVertical="$5"
      paddingHorizontal="$3.5"
      borderWidth={1}
      borderColor="$accentLine"
      borderRadius="$sheet"
      backgroundColor="$surface2">
      <BrandIcon size="$14" testID={ABOUT_BRAND_PART.ICON} />
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
