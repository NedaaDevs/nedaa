import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import ms from "@/localization/locales/ms.json";
import ur from "@/localization/locales/ur.json";
import { CUSTOM_SOUND_MAX_MB } from "@/constants/CustomSound";
import { usePreferencesStore } from "@/stores/preferences";
import { hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

const LOCALES = { ar, en, ms, ur } as const;
const ARABIC_COUNTS = [0, 1, 2, 3, 11, 100] as const;

const sayAr = (key: string, count: number) => i18n.t(key, { count, lng: AppLocale.AR });
const sayEn = (key: string, count: number) => i18n.t(key, { count, lng: AppLocale.EN });

// Western digits keep the expected strings readable; the forms are what is under test.
beforeAll(() => usePreferencesStore.setState({ useWesternNumerals: true }));

// Each Arabic form is a whole phrase; the count never lands in a fixed noun.
describe("counted phrases", () => {
  it.each([
    [
      "alarm.complete.sunriseIn",
      [
        "الشروق بعد أقل من دقيقة",
        "الشروق بعد دقيقة واحدة",
        "الشروق بعد دقيقتين",
        "الشروق بعد 3 دقائق",
        "الشروق بعد 11 دقيقة",
        "الشروق بعد 100 دقيقة",
      ],
    ],
    [
      "notification.customSettings",
      [
        "لا إعدادات مخصصة",
        "إعداد مخصص واحد",
        "إعدادان مخصصان",
        "3 إعدادات مخصصة",
        "11 إعدادًا مخصصًا",
        "100 إعداد مخصص",
      ],
    ],
    [
      "notification.customSound.sounds",
      ["لا أصوات", "صوت واحد", "صوتان", "3 أصوات", "11 صوتًا", "100 صوت"],
    ],
    [
      "notification.qada.ramadanIn",
      [
        "يبدأ رمضان اليوم.",
        "بقي يوم واحد على رمضان.",
        "بقي يومان على رمضان.",
        "بقي 3 أيام على رمضان.",
        "بقي 11 يومًا على رمضان.",
        "بقي 100 يوم على رمضان.",
      ],
    ],
    [
      "notification.qada.fastsOwed",
      [
        "لم يبقَ عليك شيء من صيام القضاء.",
        "عليك يوم واحد من صيام القضاء.",
        "عليك يومان من صيام القضاء.",
        "عليك 3 أيام من صيام القضاء.",
        "عليك 11 يومًا من صيام القضاء.",
        "عليك 100 يوم من صيام القضاء.",
      ],
    ],
    [
      "quran.highlight.verseCount",
      ["لا آيات بعد", "آية واحدة", "آيتان", "3 آيات", "11 آية", "100 آية"],
    ],
    ["quran.surah.ayahCount", ["لا آيات", "آية واحدة", "آيتان", "3 آيات", "11 آية", "100 آية"]],
  ])("says %s in Arabic with all six forms", (key, sentences) => {
    ARABIC_COUNTS.forEach((count, i) => expect(sayAr(key, count)).toBe(sentences[i]));
  });

  it.each([
    ["alarm.complete.sunriseIn", "Sunrise in 1 min", "Sunrise in 5 min"],
    ["notification.customSettings", "1 custom setting", "5 custom settings"],
    ["notification.customSound.sounds", "1 sound", "5 sounds"],
    ["notification.qada.ramadanIn", "Ramadan begins in 1 day.", "Ramadan begins in 5 days."],
    [
      "notification.qada.fastsOwed",
      "You have 1 missed fast to make up.",
      "You have 5 missed fasts to make up.",
    ],
    ["quran.highlight.verseCount", "1 verse", "5 verses"],
    ["quran.surah.ayahCount", "1 ayah", "5 ayahs"],
  ])("says %s in English", (key, one, five) => {
    expect(sayEn(key, 1)).toBe(one);
    expect(sayEn(key, 5)).toBe(five);
  });

  it.each([
    [AppLocale.MS, "5 tetapan tersuai"],
    [AppLocale.UR, "5 حسبِ ضرورت ترتیبات"],
  ])("fills the count in %s", (lng, phrase) => {
    expect(i18n.t("notification.customSettings", { count: 5, lng })).toBe(phrase);
  });

  it("gives a year of qada days the form 365 takes", () => {
    expect(sayAr("qada.days", 365)).toBe("365 يومًا");
  });
});

describe("the compass dial's spoken heading", () => {
  const reference = "R";
  const sayDial = (count: number, lng: AppLocale) =>
    i18n.t("a11y.compass.dial", { count, reference, lng });

  it("inflects the degrees in Arabic with all six forms", () => {
    expect(ARABIC_COUNTS.map((count) => sayDial(count, AppLocale.AR))).toEqual([
      "اتجاه البوصلة 0 درجة، R",
      "اتجاه البوصلة درجة واحدة، R",
      "اتجاه البوصلة درجتان، R",
      "اتجاه البوصلة 3 درجات، R",
      "اتجاه البوصلة 11 درجة، R",
      "اتجاه البوصلة 100 درجة، R",
    ]);
  });

  it("says one degree in English", () => {
    expect(sayDial(1, AppLocale.EN)).toBe("Compass heading 1 degree, R");
  });
});

describe("the Hijri converter's offset note", () => {
  it.each([
    [AppLocale.AR, -1, "التاريخ معدَّل حسب إعداداتك: ناقص يوم واحد"],
    [AppLocale.AR, 3, "التاريخ معدَّل حسب إعداداتك: زائد 3 أيام"],
    [AppLocale.EN, 2, "Adjusted per your settings: Plus 2 days"],
  ])("states the %s offset %i as one phrase", (lng, offset, sentence) => {
    const adjustment = hijriAdjustmentLabel(offset, i18n.getFixedT(lng));
    expect(i18n.t("tools.hijriConverter.offsetNote", { adjustment, lng })).toBe(sentence);
  });
});

describe("the night timings note", () => {
  const NIGHT = "notification.otherTiming.group.night.description";

  it.each(Object.entries(LOCALES))("has one line per midnight mode in %s", (_, locale) => {
    const strings: Record<string, unknown> = locale;
    expect(strings[`${NIGHT}.standard`]).toEqual(expect.any(String));
    expect(strings[`${NIGHT}.jafari`]).toEqual(expect.any(String));
    expect(strings[NIGHT]).toBeUndefined();
  });

  it.each([
    ["standard", "تُحسب أوقات الليل من المدة بين غروب الشمس وشروقها."],
    ["jafari", "تُحسب أوقات الليل من المدة بين غروب الشمس والفجر."],
  ])("names the %s span in Arabic by sunset", (mode, sentence) => {
    expect(i18n.t(`${NIGHT}.${mode}`, { lng: AppLocale.AR })).toBe(sentence);
  });
});

describe("the dhikr challenge's spoken phrase", () => {
  const values = { arabic: "سبحان الله", transliteration: "SubhanAllah" };

  it("reads the Arabic phrase to an Arabic voice", () => {
    expect(i18n.t("a11y.alarm.dhikrPhrase", { ...values, lng: AppLocale.AR })).toBe(
      "الذِّكر المطلوب كتابته: سبحان الله"
    );
  });

  it("reads the transliteration in English", () => {
    expect(i18n.t("a11y.alarm.dhikrPhrase", { ...values, lng: AppLocale.EN })).toBe(
      "Dhikr to type: SubhanAllah"
    );
  });
});

describe("the custom sound size limit", () => {
  it.each(Object.entries(LOCALES))("states the enforced limit in %s", (_, locale) => {
    const strings: Record<string, unknown> = locale;
    expect(strings["notification.customSound.info"]).toContain("{{maxMb}}");
    expect(strings["notification.customSound.fileTooLarge"]).toContain("{{maxMb}}");
  });

  it("names the limit's number", () => {
    expect(
      i18n.t("notification.customSound.fileTooLarge", {
        maxMb: CUSTOM_SOUND_MAX_MB,
        lng: AppLocale.EN,
      })
    ).toContain(`${CUSTOM_SOUND_MAX_MB} MB`);
  });
});

describe("the list separator", () => {
  it.each([
    [AppLocale.AR, "، "],
    [AppLocale.EN, ", "],
    [AppLocale.MS, ", "],
    [AppLocale.UR, "، "],
  ])("joins a %s list with its own comma", (lng, separator) => {
    expect(i18n.t("common.listSeparator", { lng })).toBe(separator);
  });
});

describe("retired keys", () => {
  const RETIRED = /^(common\.nedaa|qada\.daysCount|notification\.qada\.bodyRamadan)(_|$)/;

  it.each(Object.entries(LOCALES))("are gone from %s", (_, locale) => {
    expect(Object.keys(locale).filter((key) => RETIRED.test(key))).toEqual([]);
  });
});
