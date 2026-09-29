import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { BellMinus, Users, type LucideIcon } from "lucide-react-native";

import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SoundPicker } from "@/components/ui/sound-picker";
import { SwitchGroup } from "@/components/ui/switch-group";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  NOTIFICATION_FIELD,
  NOTIFICATION_TIMING_CHOICES,
  NOTIFICATION_TYPE,
} from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";
import { PlatformType } from "@/enums/app";
import { usePrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { getSoundChoiceGroups, isNotificationSound } from "@/utils/sound";

/** The alerts set a number of minutes away from the Athan. */
export type TimedAlertType = typeof NOTIFICATION_TYPE.IQAMA | typeof NOTIFICATION_TYPE.PRE_ATHAN;

// Iqama is scheduled after the Athan, pre-Athan before it.
const COPY = {
  [NOTIFICATION_TYPE.IQAMA]: {
    icon: Users,
    title: "prayerDetail.iqama.title",
    summary: "prayerDetail.iqama.summary",
    timing: "prayerDetail.iqama.timing",
  },
  [NOTIFICATION_TYPE.PRE_ATHAN]: {
    icon: BellMinus,
    title: "prayerDetail.preAthan.title",
    summary: "prayerDetail.preAthan.summary",
    timing: "prayerDetail.preAthan.timing",
  },
} as const satisfies Record<
  TimedAlertType,
  { icon: LucideIcon; title: string; summary: string; timing: string }
>;

/** A prayer's timed alert; while on, its minutes, sound and vibration. */
export const TimedAlertGroup = ({
  prayerId,
  type,
}: {
  prayerId: PrayerId;
  type: TimedAlertType;
}) => {
  const { t } = useTranslation();
  const { configs, update } = usePrayerAlertSettings(prayerId);
  const customSounds = useCustomSoundsStore((state) => state.customSounds);
  const config = configs[type];
  const copy = COPY[type];

  const soundGroups = getSoundChoiceGroups(type, customSounds, t);
  const soundLabel =
    soundGroups.flatMap((group) => group.options).find((option) => option.value === config.sound)
      ?.label ?? t("prayerDetail.soundPicker.unset");

  const summary = config.enabled
    ? t(copy.summary, { count: config.timing, sound: soundLabel })
    : t("common.off");

  return (
    <SwitchGroup
      icon={copy.icon}
      label={t(copy.title)}
      summary={summary}
      value={config.enabled}
      onValueChange={(enabled) => update(type, NOTIFICATION_FIELD.ENABLED, enabled)}>
      <VStack gap="$tight">
        {/* The pill group carries this name, so a screen reader skips the caption. */}
        <Text
          size="xs"
          color="$muted"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {t(copy.timing)}
        </Text>
        {/* A stored timing outside the choices selects no pill until one is picked. */}
        <SegmentedChoice<number>
          options={NOTIFICATION_TIMING_CHOICES}
          value={config.timing}
          onChange={(minutes) => update(type, NOTIFICATION_FIELD.TIMING, minutes)}
          accessibilityLabel={t(copy.timing)}
          label={String}
          spokenLabel={(minutes) => t("common.minute", { count: minutes })}
        />
      </VStack>
      <SoundPicker
        label={t("notification.sound")}
        groups={soundGroups}
        value={config.sound}
        onChange={(sound) => {
          if (isNotificationSound(type, sound)) void update(type, NOTIFICATION_FIELD.SOUND, sound);
        }}
      />
      {Platform.OS === PlatformType.ANDROID ? (
        <SwitchGroup
          label={t("notification.vibration")}
          value={config.vibration}
          onValueChange={(vibration) => update(type, NOTIFICATION_FIELD.VIBRATION, vibration)}
        />
      ) : null}
    </SwitchGroup>
  );
};
