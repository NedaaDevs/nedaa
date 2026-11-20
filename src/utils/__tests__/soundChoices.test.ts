import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { ALARM_SOUND_KEYS, SOUND_ASSETS } from "@/constants/sounds";
import i18n from "@/localization/i18n";
import type { CustomSound } from "@/types/customSound";
import {
  chosenSoundLabel,
  getAlarmSoundChoices,
  getAvailableSounds,
  getSoundChoices,
} from "@/utils/sound";

const custom = (id: CustomSound["id"], availableFor: CustomSound["availableFor"]): CustomSound => ({
  id,
  name: `Sound ${id}`,
  contentUri: `content://media/${id}`,
  fileName: `${id}.mp3`,
  fileSize: 1,
  fileIdentifier: id,
  availableFor,
  dateAdded: "2026-09-29",
});

const t = i18n.t.bind(i18n);

describe("getSoundChoices", () => {
  it.each(Object.values(NOTIFICATION_TYPE))(
    "offers the %s bundled sounds with their preview sources",
    (type) => {
      const bundled = getSoundChoices(type, [], t);

      expect(bundled.map((option) => option.value)).toEqual(
        getAvailableSounds(type).map((option) => option.value)
      );
      for (const option of bundled) {
        const asset = SOUND_ASSETS[option.value as keyof typeof SOUND_ASSETS];
        expect(option.previewSource).toBe(asset.previewSource);
        expect(option.label).toBe(t(asset.label));
      }
    }
  );

  it("lists the custom sounds made for the type last, played from their file", () => {
    const sounds = [
      custom("custom_a", [NOTIFICATION_TYPE.PRAYER]),
      custom("custom_b", [NOTIFICATION_TYPE.IQAMA]),
    ];

    const choices = getSoundChoices(NOTIFICATION_TYPE.PRAYER, sounds, t);

    expect(choices).toHaveLength(getAvailableSounds(NOTIFICATION_TYPE.PRAYER).length + 1);
    expect(choices.at(-1)).toEqual({
      value: "custom_a",
      label: "Sound custom_a",
      previewSource: "content://media/custom_a",
    });
  });
});

describe("getAlarmSoundChoices", () => {
  it("offers the alarm sounds with their preview sources", () => {
    expect(getAlarmSoundChoices([], t, ALARM_SOUND_KEYS[0])).toEqual(
      ALARM_SOUND_KEYS.map((key) => ({
        value: key,
        label: t(SOUND_ASSETS[key].label),
        previewSource: SOUND_ASSETS[key].previewSource,
      }))
    );
  });

  // No JS runs when an alarm fires, so the alarm stores the playable URI itself.
  it("lists every custom sound last by its file, whatever it was made for", () => {
    const sound = custom("custom_a", [NOTIFICATION_TYPE.IQAMA]);

    const choices = getAlarmSoundChoices([sound], t, sound.contentUri);

    expect(choices).toHaveLength(ALARM_SOUND_KEYS.length + 1);
    expect(choices.at(-1)).toEqual({
      value: sound.contentUri,
      label: sound.name,
      previewSource: sound.contentUri,
    });
  });

  it("keeps a sound chosen outside the list, named and with nothing to preview", () => {
    const choices = getAlarmSoundChoices([], t, "iOS-Radar");

    expect(choices.at(-1)).toEqual({
      value: "iOS-Radar",
      label: t("alarm.settings.systemSound"),
      previewSource: null,
    });
  });
});

describe("chosenSoundLabel", () => {
  const mine = custom("custom_a", [NOTIFICATION_TYPE.PRAYER]);
  const choices = getSoundChoices(NOTIFICATION_TYPE.PRAYER, [mine], t);

  it("names a bundled or a custom choice", () => {
    const [bundled] = choices;

    expect(chosenSoundLabel(choices, bundled!.value, t)).toBe(bundled!.label);
    expect(chosenSoundLabel(choices, mine.id, t)).toBe(mine.name);
  });

  it("reads unset for a value no group offers", () => {
    expect(chosenSoundLabel(choices, "custom_gone", t)).toBe(t("prayerDetail.soundPicker.unset"));
  });
});
