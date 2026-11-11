import { useTranslation } from "react-i18next";

import type { StepProps } from "@/components/onboarding/flow/types";
import { WelcomeLayout } from "@/components/onboarding/flow/WelcomeLayout";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { E2E_ID } from "@/constants/E2E";
import { useAppStore } from "@/stores/app";

const LINK_SEPARATOR = " · ";

/** The first page: the app, a way in, and a quiet language change. */
export const WelcomeStep = ({ setSession, onNext, headingRef, onHeadingLayout }: StepProps) => {
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
    <WelcomeLayout
      headingRef={headingRef}
      onHeadingLayout={onHeadingLayout}
      title={t("onboarding.welcome.title")}
      body={t("onboarding.welcome.tagline")}>
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
    </WelcomeLayout>
  );
};
