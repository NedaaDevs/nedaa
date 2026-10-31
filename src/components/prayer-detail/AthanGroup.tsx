import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react-native";

import { SoundPicker } from "@/components/ui/sound-picker";
import { SwitchGroup } from "@/components/ui/switch-group";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";
import { PlatformType } from "@/enums/app";
import { usePrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { chosenSoundLabel, getSoundChoices, isNotificationSound } from "@/utils/sound";

const TYPE = NOTIFICATION_TYPE.PRAYER;

/** This prayer's Athan alert; every change writes at once. */
export const AthanGroup = ({ prayerId }: { prayerId: PrayerId }) => {
  const { t } = useTranslation();
  const { configs, update } = usePrayerAlertSettings(prayerId);
  const customSounds = useCustomSoundsStore((state) => state.customSounds);
  const config = configs[TYPE];

  const sounds = getSoundChoices(TYPE, customSounds, t);
  const soundName = chosenSoundLabel(sounds, config.sound, t);

  return (
    <SwitchGroup
      icon={Bell}
      label={t("prayerDetail.athan.title")}
      summary={config.enabled ? soundName : t("common.off")}
      hint={t("a11y.prayerDetail.athan.hint")}
      value={config.enabled}
      onValueChange={(enabled) => void update(TYPE, NOTIFICATION_FIELD.ENABLED, enabled)}>
      <SoundPicker
        label={t("notification.sound")}
        options={sounds}
        value={config.sound}
        onChange={(sound) => {
          if (isNotificationSound(TYPE, sound)) void update(TYPE, NOTIFICATION_FIELD.SOUND, sound);
        }}
      />
      {/* iOS has no per-notification vibration setting. */}
      {Platform.OS === PlatformType.ANDROID ? (
        <SwitchGroup
          label={t("notification.vibration")}
          value={config.vibration}
          onValueChange={(vibration) => void update(TYPE, NOTIFICATION_FIELD.VIBRATION, vibration)}
        />
      ) : null}
    </SwitchGroup>
  );
};
