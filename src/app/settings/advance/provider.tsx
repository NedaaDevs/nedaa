import { useRef, useState } from "react";
import type { View as NativeView } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalculationSheet } from "@/components/calculation/CalculationSheet";
import { MethodCard } from "@/components/calculation/MethodCard";
import { TodayPreview } from "@/components/calculation/TodayPreview";
import { isTunedTiming, spokenTuning, summariseTuning } from "@/components/calculation/tuning";
import { useCalculationChoices } from "@/components/calculation/useCalculationChoices";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import {
  CALCULATION_PARAM,
  CALCULATION_PICKER,
  CALCULATION_TITLE_KEY,
  type CalculationPicker,
} from "@/constants/Calculation";
import { SECTION_KIND } from "@/constants/Section";
import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { useApplyCalculation } from "@/hooks/useApplyCalculation";
import { useHaptic } from "@/hooks/useHaptic";
import { usePlace } from "@/hooks/usePlace";
import { useTodayDates } from "@/hooks/useTodayDates";
import { useAppStore } from "@/stores/app";
import { hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

const HIJRI = BACK_DESTINATION.SETTINGS_HIJRI;

/** The screen over its sky: choices drafted, previewed, applied together. */
const CalculationContent = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectionHaptic = useHaptic("selection");
  const city = usePlace().city;
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);
  const { hijri } = useTodayDates();
  const { draft, updateSettings, methodLabel, auto, asrName, midnightName, inUse } =
    useCalculationChoices();
  const { state, busy, status, apply } = useApplyCalculation();
  // A link from a prayer's sheet opens the adjustments on that prayer, once.
  const linked = useLocalSearchParams()[CALCULATION_PARAM.TUNE];
  const [focus, setFocus] = useState(isTunedTiming(linked) ? linked : undefined);
  const [picker, setPicker] = useState<CalculationPicker>(
    focus ? CALCULATION_PICKER.TUNING : CALCULATION_PICKER.METHOD
  );
  const [open, setOpen] = useState(Boolean(focus));
  // Top level: the compiler runs a hook inside a literal on first render only.
  const methodOpener = useRef<NativeView>(null);
  const asrOpener = useRef<NativeView>(null);
  const midnightOpener = useRef<NativeView>(null);
  const tuningOpener = useRef<NativeView>(null);
  const openers = {
    [CALCULATION_PICKER.METHOD]: methodOpener,
    [CALCULATION_PICKER.ASR]: asrOpener,
    [CALCULATION_PICKER.MIDNIGHT]: midnightOpener,
    [CALCULATION_PICKER.TUNING]: tuningOpener,
  };

  const show = (next: CalculationPicker) => {
    setPicker(next);
    setOpen(true);
  };

  const detailRow = (row: CalculationPicker, value: string | undefined, spoken?: string) => (
    <ListRow
      ref={openers[row]}
      variant={LIST_ROW_VARIANT.GROUPED}
      title={t(CALCULATION_TITLE_KEY[row])}
      status={value}
      spokenStatus={spoken}
      hint={t("a11y.opens", { name: t(CALCULATION_TITLE_KEY[row]) })}
      disabled={busy}
      onPress={() => show(row)}
    />
  );

  return (
    <>
      {/* The sky runs under the status bar; the content pads itself clear of it. */}
      <SkyScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          // The bar draws its own inset while it shows.
          paddingBottom: state === STICKY_ACTION_STATE.HIDDEN ? insets.bottom : 0,
        }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("settings.advance.provider.title")}
            back={{ fallback: BACK_DESTINATION.SETTINGS }}
          />
        </SkyOccluder>

        <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
          <Text size="sm" color="$mutedSky">
            {city
              ? t("settings.calculation.intro", { city })
              : t("settings.calculation.introNoPlace")}
          </Text>

          <TodayPreview draft={draft} />

          <SkyOccluder>
            <VStack gap="$5">
              <Section title={t("settings.calculation.sections.method")} kind={SECTION_KIND.LABEL}>
                <MethodCard
                  ref={openers[CALCULATION_PICKER.METHOD]}
                  name={methodLabel}
                  auto={auto}
                  disabled={busy}
                  onPress={() => show(CALCULATION_PICKER.METHOD)}
                />
              </Section>

              <Section title={t("settings.calculation.sections.details")} kind={SECTION_KIND.LABEL}>
                <ListGroup>
                  {detailRow(CALCULATION_PICKER.ASR, asrName)}
                  {detailRow(CALCULATION_PICKER.MIDNIGHT, midnightName)}
                  {detailRow(
                    CALCULATION_PICKER.TUNING,
                    summariseTuning(draft.tune, t) ?? t("prayerDetail.adjustment.none"),
                    spokenTuning(draft.tune, t) ?? undefined
                  )}
                </ListGroup>
              </Section>

              {/* Applies on its own screen at once, outside the draft. */}
              <Section title={t(HIJRI.title)} kind={SECTION_KIND.LABEL}>
                <ListGroup>
                  <ListRow
                    variant={LIST_ROW_VARIANT.GROUPED}
                    title={hijri}
                    status={hijriAdjustmentLabel(hijriOffset, t)}
                    hint={t("a11y.opens", { name: t(HIJRI.title) })}
                    onPress={async () => {
                      await selectionHaptic();
                      router.push(HIJRI.href);
                    }}
                  />
                </ListGroup>
              </Section>
            </VStack>
          </SkyOccluder>
        </VStack>
      </SkyScrollView>

      {/* Outside the scroll view, so it stays in reach at any scroll. */}
      <StickyActionBar
        state={state}
        label={t("settings.calculation.apply")}
        busyStatus={status}
        onPress={apply}
      />

      <CalculationSheet
        picker={picker}
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setFocus(undefined);
        }}
        settings={draft}
        inUse={inUse}
        onChange={updateSettings}
        opener={openers[picker]}
        focus={focus}
      />
    </>
  );
};

const CalculationSettings = () => (
  <SkyBackground>
    <CalculationContent />
  </SkyBackground>
);

export default CalculationSettings;
