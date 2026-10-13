import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Platform,
  type HostInstance,
  type View as NativeView,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  ASR_OPTIONS,
  MIDNIGHT_OPTIONS,
  matchesQuery,
  methodsMatching,
  type CalculationOption,
} from "@/components/calculation/calculationOptions";
import { TuningEditor } from "@/components/calculation/TuningEditor";
import {
  Actionsheet,
  ActionsheetCloseButton,
  ActionsheetContent,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { HStack } from "@/components/ui/hstack";
import { LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { SearchField } from "@/components/ui/search-field";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  CALCULATION_PICKER,
  CALCULATION_TITLE_KEY,
  type CalculationPicker,
} from "@/constants/Calculation";
import { PlatformType } from "@/enums/app";
import { useHaptic } from "@/hooks/useHaptic";
import type {
  AladhanMethodId,
  AladhanPrayerTimeName,
  AladhanSettings,
} from "@/types/providers/aladhan";

/** The method list stands tall enough to search; the others fit their rows. */
const METHOD_SNAP = [90];

type PickProps = {
  label: string;
  settings: AladhanSettings;
  /** The method the provider uses while the choice is left to it. */
  inUse?: AladhanMethodId;
  /** Takes one choice; the sheet closes after it. */
  onPick: (patch: Partial<AladhanSettings>) => void;
};

/** The methods by name, searchable, headed by the provider's own choice. */
const MethodChoices = ({ label, settings, inUse, onPick }: PickProps) => {
  const { t } = useTranslation();
  // Mounted only while the sheet is up, so each opening starts unsearched.
  const [query, setQuery] = useState("");
  const auto = t("settings.summary.methodAuto");
  const methods = methodsMatching(query, ({ nameKey }) =>
    t(`providers.aladhan.methods.${nameKey}`)
  );
  const showAuto = matchesQuery(auto, query);

  return (
    <VStack gap="$3">
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t("settings.calculation.method.searchPlaceholder")}
      />
      {showAuto || methods.length > 0 ? (
        <ChoiceGroup label={label} variant={LIST_ROW_VARIANT.GROUPED}>
          {showAuto ? (
            <ChoiceRow
              key="auto"
              title={auto}
              subtitle={t("settings.calculation.method.autoNote")}
              selected={settings.method == null}
              onPress={() => onPick({ method: undefined })}
            />
          ) : null}
          {methods.map(({ id, nameKey }) => (
            <ChoiceRow
              key={id}
              title={t(`providers.aladhan.methods.${nameKey}`)}
              subtitle={id === inUse ? t("settings.calculation.method.inUse") : undefined}
              selected={settings.method === id}
              onPress={() => onPick({ method: id })}
            />
          ))}
        </ChoiceGroup>
      ) : (
        <NoMatch />
      )}
    </VStack>
  );
};

/** Says, out loud too, that the search found no method. */
const NoMatch = () => {
  const { t } = useTranslation();
  const message = t("settings.calculation.method.noMatch");

  // Android speaks the live region below; iOS has no live regions.
  useEffect(() => {
    if (Platform.OS === PlatformType.IOS) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Text
      accessibilityLiveRegion="polite"
      size="sm"
      color="$muted"
      textAlign="center"
      paddingVertical="$6">
      {message}
    </Text>
  );
};

type OptionProps<Id extends number> = {
  label: string;
  options: readonly CalculationOption<Id>[];
  selected: Id | undefined;
  onPick: (id: Id) => void;
};

/** One short-named choice per row, each with what it means. */
const OptionChoices = <Id extends number>({
  label,
  options,
  selected,
  onPick,
}: OptionProps<Id>) => {
  const { t } = useTranslation();
  return (
    <ChoiceGroup label={label} variant={LIST_ROW_VARIANT.GROUPED}>
      {options.map(({ id, nameKey, descriptionKey }) => (
        <ChoiceRow
          key={id}
          title={t(nameKey)}
          subtitle={t(descriptionKey)}
          selected={selected === id}
          onPress={() => onPick(id)}
        />
      ))}
    </ChoiceGroup>
  );
};

type Props = {
  /** The choice the sheet holds; kept while it closes, so its rows stay drawn. */
  picker: CalculationPicker;
  isOpen: boolean;
  onClose: () => void;
  settings: AladhanSettings;
  /** The method the provider uses while the choice is left to it. */
  inUse?: AladhanMethodId;
  onChange: (patch: Partial<AladhanSettings>) => void;
  /** The row that opened the sheet, which gets reader focus back after it. */
  opener?: RefObject<HostInstance | null>;
  /** The timing an adjustment sheet opens on. */
  focus?: AladhanPrayerTimeName;
};

/** The calculation's choices, one at a time, in a single sheet. */
export const CalculationSheet = ({
  picker,
  isOpen,
  onClose,
  settings,
  inUse,
  onChange,
  opener,
  focus,
}: Props) => {
  const { t } = useTranslation();
  const focused = useRef<NativeView>(null);
  const selectionHaptic = useHaptic("selection");
  const title = t(CALCULATION_TITLE_KEY[picker]);

  const pick = (patch: Partial<AladhanSettings>) => {
    selectionHaptic();
    onChange(patch);
    onClose();
  };

  const body = () => {
    switch (picker) {
      case CALCULATION_PICKER.METHOD:
        return <MethodChoices label={title} settings={settings} inUse={inUse} onPick={pick} />;
      case CALCULATION_PICKER.ASR:
        return (
          <OptionChoices
            label={title}
            options={ASR_OPTIONS}
            selected={settings.madhab}
            onPick={(madhab) => pick({ madhab })}
          />
        );
      case CALCULATION_PICKER.MIDNIGHT:
        return (
          <OptionChoices
            label={title}
            options={MIDNIGHT_OPTIONS}
            selected={settings.midnightMode}
            onPick={(midnightMode) => pick({ midnightMode })}
          />
        );
      // Apply on the screen saves; the sheet only closes.
      case CALCULATION_PICKER.TUNING:
        return (
          <TuningEditor
            settings={settings}
            onChange={(tune) => onChange({ tune })}
            focus={focus}
            focusRef={focused}
          />
        );
    }
  };

  const tall = picker === CALCULATION_PICKER.METHOD;
  return (
    <Actionsheet
      isOpen={isOpen}
      onClose={onClose}
      fitContent={!tall}
      snapPoints={tall ? METHOD_SNAP : undefined}
      finalFocusRef={opener}
      initialFocusRef={picker === CALCULATION_PICKER.TUNING && focus ? focused : undefined}>
      <ActionsheetContent>
        <VStack gap="$3">
          <HStack alignItems="center" justifyContent="space-between" gap="$3">
            <ActionsheetTitle>
              <Text size="lg" bold typography="title" color="$fg">
                {title}
              </Text>
            </ActionsheetTitle>
            <ActionsheetCloseButton onPress={onClose} />
          </HStack>
          {body()}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
