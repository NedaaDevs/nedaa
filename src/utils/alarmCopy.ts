import * as ExpoAlarm from "expo-alarm";
import i18n from "@/localization/i18n";

// Text native code shows while an alarm rings, keyed by the field it fills. The
// app picks its own language, so native code cannot rely on the phone's.
export const ALARM_COPY_KEYS = {
  stop: "alarm.challenge.dismiss",
  backupCountdown: "alarm.native.backupCountdown",
  stillRingingTitle: "alarm.native.stillRingingTitle",
  stillRingingBody: "alarm.native.stillRingingBody",
  unlockToStop: "alarm.native.unlockToStop",
  notificationBody: "alarm.native.notificationBody",
  channelName: "alarm.native.channelName",
  channelDescription: "alarm.native.channelDescription",
  snoozedTitle: "alarm.snoozedTitle",
} as const;

export type AlarmCopy = Record<keyof typeof ALARM_COPY_KEYS, string>;

// Placeholders native code replaces when it builds a snoozed alarm's title.
export const SNOOZE_TOKEN = { TITLE: "{title}", COUNT: "{count}", MAX: "{max}" } as const;

export const buildAlarmCopy = (): AlarmCopy => {
  const copy = {} as AlarmCopy;
  for (const [field, key] of Object.entries(ALARM_COPY_KEYS) as [keyof AlarmCopy, string][]) {
    copy[field] = i18n.t(key);
  }
  copy.snoozedTitle = i18n.t(ALARM_COPY_KEYS.snoozedTitle, {
    title: SNOOZE_TOKEN.TITLE,
    count: SNOOZE_TOKEN.COUNT,
    max: SNOOZE_TOKEN.MAX,
  });
  return copy;
};

const syncAlarmCopy = (): void => {
  ExpoAlarm.setAlarmCopy(buildAlarmCopy());
};

let isRegistered = false;

// Saves the copy now and after every language change.
export const registerAlarmCopySync = (): void => {
  syncAlarmCopy();
  if (isRegistered) return;
  isRegistered = true;
  i18n.on("languageChanged", syncAlarmCopy);
};
