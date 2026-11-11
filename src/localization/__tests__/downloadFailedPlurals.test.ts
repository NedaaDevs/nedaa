import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";

const KEY = "athkar.audio.downloadFailed";

// The count carries the noun, so each Arabic form is a whole sentence.
describe("the audio download failure, counted", () => {
  afterAll(() => i18n.changeLanguage(AppLocale.EN));

  it.each([
    [1, "ملف صوتي واحد"],
    [2, "ملفين صوتيين"],
    [3, "ملفات صوتية"],
    [11, "ملفًا صوتيًا"],
    [100, "ملف صوتي"],
  ])("says %i in Arabic with its own form", async (count, phrase) => {
    await i18n.changeLanguage(AppLocale.AR);

    const sentence = i18n.t(KEY, { count });
    expect(sentence).toContain(phrase);
    expect(sentence.startsWith("تعذّر تنزيل")).toBe(true);
  });

  it.each([
    [1, "1 audio file couldn't be downloaded"],
    [3, "3 audio files couldn't be downloaded"],
  ])("says %i in English", async (count, sentence) => {
    await i18n.changeLanguage(AppLocale.EN);

    expect(i18n.t(KEY, { count })).toBe(sentence);
  });
});
