import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react-native";

import { SoundPicker } from "@/components/ui/sound-picker";
import { SwitchGroup } from "@/components/ui/switch-group";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";
import { PlatformType } from "@/enums/app";
import { usePrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { getSoundChoiceGroups, isNotificationSound } from "@/utils/sound";

const TYPE = NOTIFICATION_TYPE.PRAYER;

/** This prayer's Athan alert; every change writes at once. */
export const AthanGroup = ({ prayerId }: { prayerId: PrayerId }) => {
  const { t } = useTranslation();
  const { configs, update } = usePrayerAlertSettings(prayerId);
  const customSounds = useCustomSoundsStore((state) => state.customSounds);
  const config = configs[TYPE];

  const groups = getSoundChoiceGroups(TYPE, customSounds, t);
  const soundName =
    groups.flatMap((group) => group.options).find((option) => option.value === config.sound)
      ?.label ?? t("prayerDetail.soundPicker.unset");
  const soundLabel = t("prayerDetail.athan.sound");

  return (
    <SwitchGroup
      icon={Bell}
      label={t("prayerDetail.athan.title")}
      summary={config.enabled ? soundName : t("prayerDetail.athan.off")}
      hint={t("a11y.prayerDetail.athan.hint")}
      value={config.enabled}
      onValueChange={(enabled) => void update(TYPE, NOTIFICATION_FIELD.ENABLED, enabled)}>
      <VStack gap="$1.5">
        <Text size="xs" color="$muted">
          {soundLabel}
        </Text>
        <SoundPicker
          label={soundLabel}
          groups={groups}
          value={config.sound}
          onChange={(sound) => {
            if (isNotificationSound(TYPE, sound))
              void update(TYPE, NOTIFICATION_FIELD.SOUND, sound);
          }}
        />
      </VStack>
      {/* iOS has no per-notification vibration setting. */}
      {Platform.OS === PlatformType.ANDROID ? (
        <SwitchGroup
          label={t("prayerDetail.athan.vibration")}
          value={config.vibration}
          onValueChange={(vibration) => void update(TYPE, NOTIFICATION_FIELD.VIBRATION, vibration)}
        />
      ) : null}
    </SwitchGroup>
  );
};
