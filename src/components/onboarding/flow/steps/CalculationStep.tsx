import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";

import { CalculationSheet } from "@/components/calculation/CalculationSheet";
import { MethodCard } from "@/components/calculation/MethodCard";
import { TodayPreview } from "@/components/calculation/TodayPreview";
import { useCalculationChoices } from "@/components/calculation/useCalculationChoices";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  CALCULATION_PICKER,
  CALCULATION_TITLE_KEY,
  type OnboardingCalculationPicker,
} from "@/constants/Calculation";
import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { useApplyCalculation } from "@/hooks/useApplyCalculation";
import { usePlace } from "@/hooks/usePlace";
import { useProviderSettingsStore } from "@/stores/providerSettings";

/** The provider's method for this city, changed through the Settings parts. */
export const CalculationStep = ({
  onNext,
  setBusy,
  setPrimary,
  headingRef,
  onHeadingLayout,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const city = usePlace().city;
  const { draft, updateSettings, methodLabel, auto, asrName, midnightName, inUse } =
    useCalculationChoices();
  const { state, busy, apply } = useApplyCalculation();
  const discardDraft = useProviderSettingsStore((store) => store.discardDraft);
  const [picker, setPicker] = useState<OnboardingCalculationPicker>(CALCULATION_PICKER.METHOD);
  const [open, setOpen] = useState(false);
  // Top level: the compiler runs a hook inside a literal on first render only.
  const methodOpener = useRef<ViewInstance>(null);
  const asrOpener = useRef<ViewInstance>(null);
  const midnightOpener = useRef<ViewInstance>(null);
  const openers = {
    [CALCULATION_PICKER.METHOD]: methodOpener,
    [CALCULATION_PICKER.ASR]: asrOpener,
    [CALCULATION_PICKER.MIDNIGHT]: midnightOpener,
  };

  // An unapplied draft ends with the step; a running apply keeps its own.
  useEffect(() => () => discardDraft(), [discardDraft]);

  // The apply holds back and skip while it runs.
  const reportBusy = useEffectEvent(setBusy);
  useEffect(() => {
    reportBusy(busy);
  }, [busy]);

  const applyAndContinue = async () => {
    await apply();
    // A failed apply keeps the draft and the step for the toast's retry.
    if (!useProviderSettingsStore.getState().isModified) onNext();
  };

  useStepPrimary(
    setPrimary,
    state === STICKY_ACTION_STATE.HIDDEN
      ? null
      : { label: t("onboarding.calculation.apply"), onPress: () => void applyAndContinue() }
  );

  const show = (next: OnboardingCalculationPicker) => {
    setPicker(next);
    setOpen(true);
  };
  const detailRow = (row: OnboardingCalculationPicker, value: string | undefined) => (
    <ListRow
      ref={openers[row]}
      variant={LIST_ROW_VARIANT.GROUPED}
      title={t(CALCULATION_TITLE_KEY[row])}
      status={value}
      hint={t("a11y.opens", { name: t(CALCULATION_TITLE_KEY[row]) })}
      disabled={busy}
      onPress={() => show(row)}
    />
  );

  return (
    <>
      <StepBody>
        <StepHeading
          headingRef={headingRef}
          onHeadingLayout={onHeadingLayout}
          progress={progress}
          title={t("onboarding.calculation.title")}
          body={
            city
              ? t("onboarding.calculation.intro", { city })
              : t("settings.calculation.introNoPlace")
          }
        />
        <TodayPreview draft={draft} />
        <SkyOccluder>
          <VStack gap="$4">
            <MethodCard
              ref={methodOpener}
              name={methodLabel}
              auto={auto}
              disabled={busy}
              onPress={() => show(CALCULATION_PICKER.METHOD)}
            />
            <ListGroup>
              {detailRow(CALCULATION_PICKER.ASR, asrName)}
              {detailRow(CALCULATION_PICKER.MIDNIGHT, midnightName)}
            </ListGroup>
            <Text size="sm" color="$mutedSky">
              {t("onboarding.calculation.tuningLater")}
            </Text>
          </VStack>
        </SkyOccluder>
      </StepBody>

      <CalculationSheet
        picker={picker}
        isOpen={open}
        onClose={() => setOpen(false)}
        settings={draft}
        inUse={inUse}
        onChange={updateSettings}
        opener={openers[picker]}
      />
    </>
  );
};
