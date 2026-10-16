import { useTranslation } from "react-i18next";

import { PILL_TONE, Pill } from "@/components/ui/pill";
import { SkyHero } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFocusPrayer } from "@/hooks/useFocusPrayer";
import { usePlace } from "@/hooks/usePlace";

/** Test ids for the hero's parts. */
export const LANGUAGE_HERO_PART = {
  CITY: "language-hero-city",
  COUNTRY: "language-hero-country",
  CHIP: "language-hero-chip",
} as const;

/** The place and the focus prayer, as the app's language names them now. */
export const LanguageHero = () => {
  const { t } = useTranslation();
  const { city, country, name } = usePlace();
  const focus = useFocusPrayer();
  if (!name && !focus) return null;

  const placeLabel = t("settings.languages.yourPlace");
  const spoken = [
    name && t("a11y.labelled", { label: placeLabel, value: name }),
    focus && t("a11y.labelled", { label: focus.label, value: focus.name }),
  ]
    .filter((part): part is string => Boolean(part))
    .reduce((first, second) => t("a11y.sentences", { first, second }));

  return (
    <SkyHero accessibilityLabel={spoken} compact={!name}>
      {name ? (
        <VStack marginBottom={focus ? "$4" : undefined}>
          <Text size="sm" bold typography="helper" color="$mutedSky">
            {placeLabel}
          </Text>
          {city ? (
            <Text
              testID={LANGUAGE_HERO_PART.CITY}
              size="2xl"
              bold
              typography="display"
              color="$fg"
              marginTop="$2.5">
              {city}
            </Text>
          ) : null}
          {country ? (
            <Text
              testID={LANGUAGE_HERO_PART.COUNTRY}
              size="sm"
              fontWeight="600"
              typography="helper"
              color="$mutedSky"
              marginTop="$0.5">
              {country}
            </Text>
          ) : null}
        </VStack>
      ) : null}
      {focus ? (
        <Pill
          testID={LANGUAGE_HERO_PART.CHIP}
          label={focus.label}
          tone={PILL_TONE.NEUTRAL}
          alignSelf="flex-start"
          dot>
          {focus.name}
        </Pill>
      ) : null}
    </SkyHero>
  );
};
