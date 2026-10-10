import i18n from "@/localization/i18n";
import translationAR from "@/localization/locales/ar.json";
import translationEN from "@/localization/locales/en.json";
import translationMS from "@/localization/locales/ms.json";
import translationUR from "@/localization/locales/ur.json";
import { AppLocale } from "@/enums/app";
import {
  ALARM_COPY_KEYS,
  buildAlarmCopy,
  registerAlarmCopySync,
  SNOOZE_TOKEN,
} from "@/utils/alarmCopy";

const mockSetAlarmCopy = jest.fn();
jest.mock("expo-alarm", () => ({
  setAlarmCopy: (copy: Record<string, string>) => mockSetAlarmCopy(copy),
}));

const LOCALES: Record<AppLocale, Record<string, unknown>> = {
  [AppLocale.AR]: translationAR,
  [AppLocale.EN]: translationEN,
  [AppLocale.MS]: translationMS,
  [AppLocale.UR]: translationUR,
};

describe("alarm copy for native code", () => {
  it.each(Object.entries(LOCALES))("has every native key in %s", (_locale, translation) => {
    for (const key of Object.values(ALARM_COPY_KEYS)) {
      expect(translation[key]).toEqual(expect.any(String));
    }
  });

  // Native code fills the snoozed title itself, so it receives the placeholders.
  it.each(Object.keys(LOCALES))("keeps the snooze placeholders in %s", async (locale) => {
    await i18n.changeLanguage(locale);

    const { snoozedTitle } = buildAlarmCopy();

    for (const token of Object.values(SNOOZE_TOKEN)) {
      expect(snoozedTitle).toContain(token);
    }
  });

  // Native code shows the text as given, so a nested key must arrive resolved.
  it.each(Object.keys(LOCALES))(
    "resolves nested keys before native code sees %s",
    async (locale) => {
      await i18n.changeLanguage(locale);

      const copy = buildAlarmCopy();

      expect(copy.stillRingingBody).toContain(i18n.t("brand.name"));
      for (const text of Object.values(copy)) {
        expect(text).not.toContain("$t(");
      }
    }
  );

  it("saves the copy now and again in the new language after a change", async () => {
    await i18n.changeLanguage(AppLocale.EN);
    mockSetAlarmCopy.mockClear();

    registerAlarmCopySync();
    await i18n.changeLanguage(AppLocale.AR);

    expect(mockSetAlarmCopy).toHaveBeenCalledTimes(2);
    expect(mockSetAlarmCopy.mock.calls[1][0].notificationBody).toBe(
      translationAR[ALARM_COPY_KEYS.notificationBody]
    );
  });
});
