import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { CLOCK_SAMPLE } from "@/constants/Onboarding";
import { CLOCK_FORMAT, NUMERAL_STYLE } from "@/constants/Preferences";
import { AppLocale } from "@/enums/app";
import { useClockTime } from "@/hooks/useClockTime";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";

const CLOCK_FORMATS = Object.values(CLOCK_FORMAT);
const NUMERAL_STYLES = Object.values(NUMERAL_STYLE);

/** The digits and the clock, the Settings controls, with a sample time. */
export const NumeralsStep = ({ headingRef, onHeadingLayout, progress }: StepProps) => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const setUse24HourTime = usePreferencesStore((state) => state.setUse24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const setUseWesternNumerals = usePreferencesStore((state) => state.setUseWesternNumerals);
  const clock = useClockTime();
  const sample = clock(parseISO(CLOCK_SAMPLE.ISO), CLOCK_SAMPLE.TIMEZONE);

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        title={t("onboarding.numerals.title")}
        body={t("onboarding.numerals.body")}
      />
      <SkyOccluder>
        <VStack gap="$4">
          {/* Only Arabic writes numbers in digits of its own. */}
          {locale === AppLocale.AR ? (
            <SegmentedChoice
              options={NUMERAL_STYLES}
              value={western ? NUMERAL_STYLE.WESTERN : NUMERAL_STYLE.ARABIC}
              onChange={(style) => setUseWesternNumerals(style === NUMERAL_STYLE.WESTERN)}
              accessibilityLabel={t("settings.preferences.numerals.title")}
              label={(style) => t(`settings.preferences.numerals.options.${style}`)}
              spokenLabel={(style) => t(`settings.preferences.numerals.spoken.${style}`)}
              literalDigits
            />
          ) : null}
          <SegmentedChoice
            options={CLOCK_FORMATS}
            value={use24HourTime ? CLOCK_FORMAT.TWENTY_FOUR_HOUR : CLOCK_FORMAT.TWELVE_HOUR}
            onChange={(format) => setUse24HourTime(format === CLOCK_FORMAT.TWENTY_FOUR_HOUR)}
            accessibilityLabel={t("settings.preferences.clock.title")}
            label={(format) => t(`settings.preferences.clock.options.${format}`)}
            spokenLabel={(format) => t(`settings.preferences.clock.spoken.${format}`)}
          />
          <OnboardingCard
            accessible
            accessibilityLabel={t("a11y.join", {
              first: t("onboarding.numerals.sample"),
              second: sample.spoken,
            })}
            gap="$1">
            <Text size="xs" color="$mutedSky">
              {t("onboarding.numerals.sample")}
            </Text>
            <Text size="2xl" bold numeric color="$fg">
              {sample.shown}
            </Text>
          </OnboardingCard>
        </VStack>
      </SkyOccluder>
    </StepBody>
  );
};
