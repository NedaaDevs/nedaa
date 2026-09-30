import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import type { ParseKeys } from "i18next";
import { Check, ChevronDown, ChevronUp, Play, Square } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SOUND_PICKER_GROUP, type SoundPickerGroupId } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import type { SoundChoice, SoundChoiceGroup } from "@/types/sound";
import { chosenSoundLabel, soundPreviewManager } from "@/utils/sound";

const GROUP_TITLE = {
  [SOUND_PICKER_GROUP.BUNDLED]: "prayerDetail.soundPicker.bundled",
  [SOUND_PICKER_GROUP.CUSTOM]: "prayerDetail.soundPicker.custom",
} as const satisfies Record<SoundPickerGroupId, ParseKeys>;

export type SoundPickerProps<K extends string> = {
  /** Captions the trigger and names it and the list, e.g. "Sound". */
  label: string;
  /** Sources in order; an empty one is not shown. */
  groups: readonly SoundChoiceGroup<K>[];
  value: K;
  onChange: (value: K) => void;
};

const subscribe = (listener: () => void) => soundPreviewManager.addListener(listener);
const currentPreview = () => soundPreviewManager.getCurrentSound();

/** Stops the preview only when this picker started it. */
const stopOwnPreview = (owner: string) => {
  if (currentPreview()?.startsWith(owner)) void soundPreviewManager.stopPreview();
};

/** A trigger that opens every sound in place, grouped, each with a preview. */
export const SoundPicker = <K extends string>({
  label,
  groups,
  value,
  onChange,
}: SoundPickerProps<K>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const owner = useId();
  const [open, setOpen] = useState(false);
  const playing = useSyncExternalStore(subscribe, currentPreview);

  useEffect(() => () => stopOwnPreview(owner), [owner]);

  const close = () => {
    stopOwnPreview(owner);
    setOpen(false);
  };

  const chosenLabel = chosenSoundLabel(groups, value, t);

  const pick = (option: K) => {
    close();
    if (option !== value) onChange(option);
  };

  const togglePreview = (option: SoundChoice<K>, previewId: string) => {
    if (playing === previewId) {
      void soundPreviewManager.stopPreview();
    } else if (option.previewSource !== null) {
      // The manager logs a failed play and resets, so the row falls back to play.
      soundPreviewManager.playSource(previewId, option.previewSource).catch(() => {});
    }
  };

  const manageLibrary = () => {
    close();
    router.push(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.href);
  };

  return (
    <VStack gap="$tight">
      {/* The trigger speaks the label, so a screen reader skips the caption. */}
      <Text
        size="xs"
        color="$muted"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {label}
      </Text>
      <Pressable
        onPress={open ? close : () => setOpen(true)}
        accessibilityLabel={`${label}, ${chosenLabel}`}
        accessibilityHint={t("a11y.prayerDetail.soundPicker.triggerHint")}
        accessibilityState={{ expanded: open }}
        flexDirection="row"
        alignItems="center"
        gap="$inline"
        paddingHorizontal="$3"
        borderRadius="$control"
        backgroundColor="$surface2">
        <Text flex={1} size="sm" color="$fg" numberOfLines={1}>
          {chosenLabel}
        </Text>
        <Icon as={open ? ChevronUp : ChevronDown} size="sm" color="$muted" />
      </Pressable>
      {open ? (
        <VStack
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          gap="$tight"
          padding="$1.5"
          borderRadius="$card"
          backgroundColor="$surface2">
          {groups
            .filter((group) => group.options.length > 0)
            .map((group) => (
              <VStack key={group.id} gap="$tight">
                <Text
                  accessibilityRole="header"
                  size="xs"
                  color="$muted"
                  paddingHorizontal="$3"
                  paddingTop="$2">
                  {t(GROUP_TITLE[group.id])}
                </Text>
                {group.options.map((option) => {
                  const selected = option.value === value;
                  const previewId = `${owner}${option.value}`;
                  const isPlaying = playing === previewId;
                  return (
                    <HStack key={option.value} alignItems="center" gap="$tight">
                      <Pressable
                        onPress={() => pick(option.value)}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected }}
                        flex={1}
                        flexDirection="row"
                        alignItems="center"
                        gap="$inline"
                        paddingHorizontal="$3"
                        borderRadius="$control"
                        backgroundColor={selected ? "$accentSoft" : "transparent"}>
                        <Text flex={1} size="sm" color="$fg" bold={selected}>
                          {option.label}
                        </Text>
                        {selected ? <Icon as={Check} size="sm" color="$accent" /> : null}
                      </Pressable>
                      {option.previewSource !== null ? (
                        <Pressable
                          onPress={() => togglePreview(option, previewId)}
                          accessibilityLabel={t(
                            isPlaying
                              ? "a11y.prayerDetail.soundPicker.stop"
                              : "a11y.prayerDetail.soundPicker.preview",
                            { name: option.label }
                          )}
                          alignItems="center"
                          justifyContent="center"
                          borderRadius="$control">
                          <Icon as={isPlaying ? Square : Play} size="sm" color="$muted" />
                        </Pressable>
                      ) : null}
                    </HStack>
                  );
                })}
              </VStack>
            ))}
          {Platform.OS === PlatformType.ANDROID ? (
            <Pressable
              onPress={manageLibrary}
              accessibilityLabel={t("prayerDetail.soundPicker.manageLibrary")}
              accessibilityHint={t("a11y.prayerDetail.soundPicker.manageLibraryHint")}
              alignItems="center"
              justifyContent="center"
              borderRadius="$control"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="$border">
              <Text size="sm" color="$accent">
                {t("prayerDetail.soundPicker.manageLibrary")}
              </Text>
            </Pressable>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
};
