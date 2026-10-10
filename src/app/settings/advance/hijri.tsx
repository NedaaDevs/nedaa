import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HijriDateHero } from "@/components/settings/HijriDateHero";
import { HStack } from "@/components/ui/hstack";
import { Section } from "@/components/ui/section";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { SteppedSlider } from "@/components/ui/stepped-slider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SECTION_KIND } from "@/constants/Section";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { LTR_ISOLATE, localizeDigits } from "@/utils/digits";
import {
  HIJRI_NO_OFFSET,
  HIJRI_OFFSET_LIMIT,
  HIJRI_OFFSETS,
  hijriAdjustmentLabel,
} from "@/utils/hijriAdjustment";

const SIGN = { MINUS: "−", PLUS: "+" } as const;

/** The screen over its sky: the hero follows a drag, the store a release. */
const HijriContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = useAppStore((state) => state.locale);
  const hijriDaysOffset = useAppStore((state) => state.hijriDaysOffset);
  const setHijirOffset = useAppStore((state) => state.setHijirOffset);
  const useWesternNumerals = usePreferencesStore((state) => state.useWesternNumerals);
  // The offset under a drag; null once the drag lands or comes back.
  const [draft, setDraft] = useState<number | null>(null);

  const shown = draft ?? hijriDaysOffset;
  const label = (offset: number) => hijriAdjustmentLabel(offset, t);
  const title = t("settings.hijri.date.adjustmentTitle");
  const limit = localizeDigits(String(HIJRI_OFFSET_LIMIT), locale, useWesternNumerals);
  // Held left to right, so RTL text keeps the sign in front of the figure.
  const end = (sign: string) => (
    <Text size="sm" bold color="$fg">
      {`${LTR_ISOLATE.OPEN}${sign}${limit}${LTR_ISOLATE.CLOSE}`}
    </Text>
  );

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t("settings.hijri.date.title")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
        <HijriDateHero offset={shown} />

        <Section title={t("settings.hijri.date.sections.adjustment")} kind={SECTION_KIND.LABEL}>
          <SkyOccluder>
            <VStack
              gap="$3"
              padding="$4"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$card"
              backgroundColor="$surface2">
              {/* The slider speaks its name and value; this row is for the eye. */}
              <HStack
                {...HIDDEN_FROM_READER}
                alignItems="baseline"
                justifyContent="space-between"
                gap="$3">
                <Text flex={1} size="md" bold color="$fg">
                  {t("settings.hijri.date.adjustmentHead")}
                </Text>
                <Text size="sm" bold color="$accent">
                  {label(shown)}
                </Text>
              </HStack>
              <SteppedSlider
                stops={HIJRI_OFFSETS}
                value={hijriDaysOffset}
                fillFrom={HIJRI_NO_OFFSET}
                onDraft={(offset) => setDraft(offset === hijriDaysOffset ? null : offset)}
                onChange={(offset) => {
                  setDraft(null);
                  setHijirOffset(offset);
                }}
                formatValue={label}
                accessibilityLabel={title}
                startMark={end(SIGN.MINUS)}
                endMark={end(SIGN.PLUS)}
              />
            </VStack>
          </SkyOccluder>
        </Section>
      </VStack>
    </SkyScrollView>
  );
};

const HijriSettings = () => (
  <SkyBackground>
    <HijriContent />
  </SkyBackground>
);

export default HijriSettings;
