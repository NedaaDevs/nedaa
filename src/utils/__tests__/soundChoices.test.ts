import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { ALARM_SOUND_KEYS, SOUND_ASSETS, SOUND_PICKER_GROUP } from "@/constants/sounds";
import i18n from "@/localization/i18n";
import type { CustomSound } from "@/types/customSound";
import {
  chosenSoundLabel,
  getAlarmSoundChoiceGroups,
  getAvailableSounds,
  getSoundChoiceGroups,
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

describe("getSoundChoiceGroups", () => {
  it.each(Object.values(NOTIFICATION_TYPE))(
    "offers the %s bundled sounds with their preview sources",
    (type) => {
      const [bundled] = getSoundChoiceGroups(type, [], t);

      expect(bundled!.id).toBe(SOUND_PICKER_GROUP.BUNDLED);
      expect(bundled!.options.map((option) => option.value)).toEqual(
        getAvailableSounds(type).map((option) => option.value)
      );
      for (const option of bundled!.options) {
        const asset = SOUND_ASSETS[option.value as keyof typeof SOUND_ASSETS];
        expect(option.previewSource).toBe(asset.previewSource);
        expect(option.label).toBe(t(asset.label));
      }
    }
  );

  it("offers only the custom sounds made for the type, played from their file", () => {
    const sounds = [
      custom("custom_a", [NOTIFICATION_TYPE.PRAYER]),
      custom("custom_b", [NOTIFICATION_TYPE.IQAMA]),
    ];

    const [, mine] = getSoundChoiceGroups(NOTIFICATION_TYPE.PRAYER, sounds, t);

    expect(mine).toEqual({
      id: SOUND_PICKER_GROUP.CUSTOM,
      options: [
        { value: "custom_a", label: "Sound custom_a", previewSource: "content://media/custom_a" },
      ],
    });
  });

  // The notification path never offers a device ringtone.
  it("returns no group beyond bundled and custom", () => {
    const groups = getSoundChoiceGroups(NOTIFICATION_TYPE.PRAYER, [], t);

    expect(groups.map((group) => group.id)).toEqual(Object.values(SOUND_PICKER_GROUP));
  });
});

describe("getAlarmSoundChoiceGroups", () => {
  it("offers the alarm sounds with their preview sources", () => {
    const [bundled] = getAlarmSoundChoiceGroups([], t, ALARM_SOUND_KEYS[0]);

    expect(bundled).toEqual({
      id: SOUND_PICKER_GROUP.BUNDLED,
      options: ALARM_SOUND_KEYS.map((key) => ({
        value: key,
        label: t(SOUND_ASSETS[key].label),
        previewSource: SOUND_ASSETS[key].previewSource,
      })),
    });
  });

  // No JS runs when an alarm fires, so the alarm stores the playable URI itself.
  it("offers every custom sound by its file, whatever it was made for", () => {
    const sound = custom("custom_a", [NOTIFICATION_TYPE.IQAMA]);

    const [, mine] = getAlarmSoundChoiceGroups([sound], t, sound.contentUri);

    expect(mine).toEqual({
      id: SOUND_PICKER_GROUP.CUSTOM,
      options: [{ value: sound.contentUri, label: sound.name, previewSource: sound.contentUri }],
    });
  });

  it("keeps a sound chosen outside the list, named and with nothing to preview", () => {
    const [bundled] = getAlarmSoundChoiceGroups([], t, "iOS-Radar");

    expect(bundled!.options.at(-1)).toEqual({
      value: "iOS-Radar",
      label: t("alarm.settings.systemSound"),
      previewSource: null,
    });
  });
});

describe("chosenSoundLabel", () => {
  const mine = custom("custom_a", [NOTIFICATION_TYPE.PRAYER]);
  const groups = getSoundChoiceGroups(NOTIFICATION_TYPE.PRAYER, [mine], t);

  it("names a bundled or a custom choice", () => {
    const [bundled] = groups[0]!.options;

    expect(chosenSoundLabel(groups, bundled!.value, t)).toBe(bundled!.label);
    expect(chosenSoundLabel(groups, mine.id, t)).toBe(mine.name);
  });

  it("reads unset for a value no group offers", () => {
    expect(chosenSoundLabel(groups, "custom_gone", t)).toBe(t("prayerDetail.soundPicker.unset"));
  });
});
