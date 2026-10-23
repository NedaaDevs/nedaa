import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { StepProps } from "@/components/onboarding/flow/types";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { E2E_ID } from "@/constants/E2E";
import { useAppStore } from "@/stores/app";

const CENTRED = { flexGrow: 1, justifyContent: "center" } as const;
const LINK_SEPARATOR = " · ";

/** The first page: the app, a way in, and a quiet language change. */
export const WelcomeStep = ({ setSession, onNext, headingRef }: StepProps) => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const language = t(`settings.languages.${locale}.nativeTitle`);
  const change = t("onboarding.welcome.changeLanguage");

  // A language list only opened and left must not return on the way on.
  const start = () => {
    setSession({ languageRequested: false });
    onNext();
  };
  const changeLanguage = () => {
    setSession({ languageRequested: true });
    onNext();
  };

  return (
    <SkyScrollView contentContainerStyle={CENTRED} showsVerticalScrollIndicator={false}>
      <VStack alignItems="center" paddingHorizontal="$8" paddingVertical="$6" gap="$5">
        <BrandIcon size="$24" />

        <SkyOccluder>
          <VStack alignItems="center" gap="$2">
            <View ref={headingRef} accessible accessibilityRole="header">
              <Text size="3xl" bold typography="display" color="$fg" textAlign="center">
                {t("onboarding.welcome.title")}
              </Text>
            </View>
            <Text size="lg" typography="body" color="$mutedSky" textAlign="center">
              {t("onboarding.welcome.tagline")}
            </Text>
          </VStack>
        </SkyOccluder>

        <VStack alignItems="center" gap="$2">
          <Button
            testID={E2E_ID.ONBOARDING_GET_STARTED}
            action="primary"
            variant="solid"
            size="lg"
            paddingHorizontal="$12"
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.welcome.getStarted")}>
            <Button.Text fontWeight="500">{t("onboarding.welcome.getStarted")}</Button.Text>
          </Button>
          <SkyOccluder>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("a11y.join", { first: language, second: change })}
              accessibilityHint={t("a11y.onboarding.changeLanguageHint")}
              onPress={changeLanguage}
              justifyContent="center"
              alignItems="center">
              <Text size="sm" fontWeight="600" color="$accentText">
                {`${language}${LINK_SEPARATOR}${change}`}
              </Text>
            </Pressable>
          </SkyOccluder>
        </VStack>
      </VStack>
    </SkyScrollView>
  );
};
