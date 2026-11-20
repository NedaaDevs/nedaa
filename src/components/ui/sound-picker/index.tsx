import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { HAIRLINE_STROKE, Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SoundPreview } from "@/components/ui/sound-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { SoundChoice } from "@/types/sound";
import { chosenSoundLabel } from "@/utils/sound";

export type SoundPickerProps<K extends string> = {
  /** Captions the trigger and names it and the list, e.g. "Sound". */
  label: string;
  /** Every sound in the order the list shows them. */
  options: readonly SoundChoice<K>[];
  value: K;
  onChange: (value: K) => void;
};

/** Opens every sound in place, beside a preview of the chosen one. */
export const SoundPicker = <K extends string>({
  label,
  options,
  value,
  onChange,
}: SoundPickerProps<K>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const chosenLabel = chosenSoundLabel(options, value, t);
  const previewSource = options.find((option) => option.value === value)?.previewSource ?? null;

  const pick = (option: K) => {
    setOpen(false);
    if (option !== value) onChange(option);
  };

  return (
    <VStack gap="$tight">
      {/* The trigger speaks the label, so a screen reader skips the caption. */}
      <Text
        size="xs"
        fontWeight="600"
        color="$muted"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {label}
      </Text>
      <HStack alignItems="center" gap="$inline">
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityLabel={`${label}, ${chosenLabel}`}
          accessibilityHint={t("a11y.prayerDetail.soundPicker.triggerHint")}
          accessibilityState={{ expanded: open }}
          flex={1}
          flexDirection="row"
          alignItems="center"
          gap="$inline"
          paddingHorizontal="$2.5"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$control"
          backgroundColor="$surface2Soft">
          <Text flex={1} size="sm" color="$fg" numberOfLines={1}>
            {chosenLabel}
          </Text>
          <Icon
            as={open ? ChevronUp : ChevronDown}
            size="sm"
            color="$muted"
            strokeWidth={HAIRLINE_STROKE}
          />
        </Pressable>
        <SoundPreview
          source={previewSource}
          playLabel={t("a11y.prayerDetail.soundPicker.preview", { name: chosenLabel })}
          stopLabel={t("a11y.prayerDetail.soundPicker.stop", { name: chosenLabel })}
        />
      </HStack>
      {open ? (
        <VStack
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          marginTop="$0.5"
          gap="$tight"
          padding="$1.5"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$control"
          backgroundColor="$surface2Soft">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => pick(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                flexDirection="row"
                alignItems="center"
                gap="$inline"
                paddingHorizontal="$2"
                borderRadius="$chip"
                backgroundColor={selected ? "$accentSoft" : "transparent"}>
                <Text flex={1} size="sm" color="$fg">
                  {option.label}
                </Text>
                {selected ? <Icon as={Check} size="sm" color="$fg" /> : null}
              </Pressable>
            );
          })}
        </VStack>
      ) : null}
    </VStack>
  );
};
