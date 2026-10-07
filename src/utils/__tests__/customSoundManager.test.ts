import type { DocumentPickerAsset } from "expo-document-picker";

import { ALARM_TYPE } from "@/constants/Alarm";
import { PRAYER_ID } from "@/constants/Prayer";
import { CUSTOM_SOUND_ERROR, CUSTOM_SOUND_MAX_BYTES } from "@/constants/CustomSound";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import type { NotificationSettings } from "@/types/notification";

import {
  getCustomSoundUsages,
  replaceCustomSoundInSettings,
  getAlarmUsagesForUri,
  releaseCustomSoundFromAlarms,
  CUSTOM_SOUND_REPLACEMENT,
  describeCustomSoundUsages,
  validateAudioFile,
} from "@/utils/customSoundManager";

jest.mock("expo-document-picker", () => ({}));
// The size a file read from disk reports, for a picked asset that carries none.
let mockDiskSize = 0;
jest.mock("expo-file-system", () => ({
  File: class {
    get size() {
      return mockDiskSize;
    }
  },
  Paths: { cache: "" },
}));
jest.mock("expo-notifications", () => ({ AndroidImportance: { HIGH: 6 } }));
jest.mock("@/utils/sound", () => ({ getNotificationSound: () => undefined }));

// jest.mock factories are hoisted above these declarations, so anything they close
// over has to carry the `mock` prefix that the hoist check allows.
const mockSetAlarmSettings = jest.fn();
const mockGetAlarmSettings = jest.fn();
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  setAlarmSettings: (...args: unknown[]) => mockSetAlarmSettings(...args),
  getAlarmSettings: (...args: unknown[]) => mockGetAlarmSettings(...args),
}));

const mockSetSound = jest.fn();
const mockAlarmState = {
  fajr: { sound: "beep" },
  friday: { sound: "beep" },
  setSound: (...args: unknown[]) => mockSetSound(...args),
};
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: { getState: () => mockAlarmState },
}));

const CUSTOM_ID = "custom_1_abc";
const URI = "content://media/external/audio/media/42";

const buildSettings = (overrides: Partial<Record<string, string>> = {}): NotificationSettings =>
  ({
    defaults: {
      prayer: { sound: overrides.prayer ?? "makkahAthan1" },
      iqama: { sound: overrides.iqama ?? "beep" },
      preAthan: { sound: overrides.preAthan ?? "beep" },
      qada: { sound: overrides.qada ?? "beep" },
    },
    overrides: {},
  }) as unknown as NotificationSettings;

/** Makes the native read report a sound per scheduled alarm type, `beep` otherwise. */
const nativeSoundFor = (types: Record<string, string>) => {
  mockGetAlarmSettings.mockImplementation(async (scheduledType: string) => ({
    sound: types[scheduledType] ?? "beep",
  }));
};

beforeEach(() => {
  mockSetAlarmSettings.mockReset();
  mockGetAlarmSettings.mockReset();
  mockSetSound.mockReset();
  mockAlarmState.fajr.sound = "beep";
  mockAlarmState.friday.sound = "beep";
  nativeSoundFor({});
});

describe("getCustomSoundUsages", () => {
  it("reports a qada default usage", () => {
    expect(getCustomSoundUsages(CUSTOM_ID, buildSettings({ qada: CUSTOM_ID }))).toEqual([
      { type: "qada" },
    ]);
  });

  it("reports nothing when the sound is unused", () => {
    expect(getCustomSoundUsages(CUSTOM_ID, buildSettings())).toEqual([]);
  });
});

describe("replaceCustomSoundInSettings", () => {
  it("replaces a qada default with a sound valid for every type", () => {
    const next = replaceCustomSoundInSettings(
      CUSTOM_ID,
      CUSTOM_SOUND_REPLACEMENT,
      buildSettings({ qada: CUSTOM_ID })
    );
    expect(next.defaults.qada.sound).toBe("beep");
  });

  it("leaves other sounds untouched", () => {
    const next = replaceCustomSoundInSettings(
      CUSTOM_ID,
      CUSTOM_SOUND_REPLACEMENT,
      buildSettings({ qada: CUSTOM_ID, iqama: "takbir" })
    );
    expect(next.defaults.iqama.sound).toBe("takbir");
  });

  it("defaults to a replacement valid for every type", () => {
    // A prayer-only default would leave iqama, pre-athan and qada channels soundless.
    const next = replaceCustomSoundInSettings(
      CUSTOM_ID,
      undefined,
      buildSettings({ iqama: CUSTOM_ID })
    );
    expect(next.defaults.iqama.sound).toBe("beep");
  });
});

describe("getAlarmUsagesForUri", () => {
  it("reads the native database rather than the JS store", async () => {
    // The store disagrees; native holds what the alarm will actually play.
    mockAlarmState.fajr.sound = "beep";
    nativeSoundFor({ fajr: URI });

    await expect(getAlarmUsagesForUri(URI)).resolves.toEqual(["fajr"]);
  });

  it("reports unknown rather than unused when native cannot be read", async () => {
    mockGetAlarmSettings.mockResolvedValue(null);
    // The store says the sound is free, but answering from it could delete a file a
    // native alarm still points at.
    mockAlarmState.fajr.sound = "beep";
    mockAlarmState.friday.sound = "beep";

    await expect(getAlarmUsagesForUri(URI)).resolves.toBeNull();
  });

  it("finds every alarm type selecting the URI", async () => {
    nativeSoundFor({ fajr: URI, jummah: URI });
    await expect(getAlarmUsagesForUri(URI)).resolves.toEqual(["fajr", "friday"]);
  });
});

describe("releaseCustomSoundFromAlarms", () => {
  it("succeeds without writing when no alarm uses the URI", async () => {
    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(true);
    expect(mockSetAlarmSettings).not.toHaveBeenCalled();
  });

  it("refuses to release when alarm usage cannot be determined", async () => {
    mockGetAlarmSettings.mockResolvedValue(null);

    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(false);
    expect(mockSetAlarmSettings).not.toHaveBeenCalled();
  });

  it("commits both alarms only after both native writes succeed", async () => {
    nativeSoundFor({ fajr: URI, jummah: URI });
    mockSetAlarmSettings.mockResolvedValue(true);

    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(true);

    expect(mockSetSound).toHaveBeenCalledWith("fajr", "beep");
    expect(mockSetSound).toHaveBeenCalledWith("friday", "beep");
  });

  it("writes natively with the scheduled alarm type, then updates the store", async () => {
    nativeSoundFor({ jummah: URI });
    mockSetAlarmSettings.mockResolvedValue(true);

    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(true);

    // The JS settings type is "friday"; the native database keys it as "jummah".
    expect(mockSetAlarmSettings).toHaveBeenCalledWith("jummah", { sound: "beep" });
    expect(mockSetSound).toHaveBeenCalledWith("friday", "beep");
  });

  it("never commits the fallback when the native write is rejected", async () => {
    nativeSoundFor({ fajr: URI });
    // setAlarmSettings resolves false rather than throwing on failure.
    mockSetAlarmSettings.mockResolvedValue(false);

    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(false);
    // The store adopts what native actually holds, never the fallback that failed.
    expect(mockSetSound).not.toHaveBeenCalledWith("fajr", "beep");
    expect(mockSetSound).toHaveBeenCalledWith("fajr", URI);
  });

  it("restores an already-moved alarm when a later one fails", async () => {
    nativeSoundFor({ fajr: URI, jummah: URI });
    mockSetAlarmSettings
      .mockResolvedValueOnce(true) // fajr moves to beep
      .mockResolvedValueOnce(false) // jummah refuses
      .mockResolvedValueOnce(true); // fajr is put back

    await expect(releaseCustomSoundFromAlarms(URI)).resolves.toBe(false);

    // Third write is the rollback of the alarm that had already moved.
    expect(mockSetAlarmSettings).toHaveBeenNthCalledWith(3, "fajr", { sound: URI });
    expect(mockSetSound).not.toHaveBeenCalledWith("fajr", "beep");
  });
});

describe("validateAudioFile", () => {
  const asset = (size?: number) =>
    ({ name: "athan.mp3", uri: "file:///cache/athan.mp3", size }) as DocumentPickerAsset;

  it("accepts a file at the size limit", () => {
    expect(validateAudioFile(asset(CUSTOM_SOUND_MAX_BYTES))).toEqual({ valid: true });
  });

  it("rejects a file over the size limit", () => {
    expect(validateAudioFile(asset(CUSTOM_SOUND_MAX_BYTES + 1))).toEqual({
      valid: false,
      error: CUSTOM_SOUND_ERROR.TOO_LARGE,
    });
  });

  it("measures the file on disk when the picker reports no size", () => {
    mockDiskSize = CUSTOM_SOUND_MAX_BYTES + 1;
    expect(validateAudioFile(asset()).valid).toBe(false);
  });
});

describe("describeCustomSoundUsages", () => {
  it("names each prayer and joins the list with the locale's comma", () => {
    const label = describeCustomSoundUsages(
      [{ type: "prayer", prayerId: PRAYER_ID.FAJR }, { type: "qada" }],
      [ALARM_TYPE.FRIDAY],
      i18n.getFixedT(AppLocale.AR)
    );

    expect(label).toBe("إشعارات صلاة الفجر، إشعارات القضاء الافتراضية، منبّه الجمعة");
  });
});
