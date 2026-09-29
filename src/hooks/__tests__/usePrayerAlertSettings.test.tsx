import { act, renderHook } from "@testing-library/react-native";

import { usePrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";
import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import type { IqamaSoundKey, PrayerSoundKey } from "@/constants/sounds";

jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ locationDetails: { timezone: "UTC" } })) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ twoWeeksTimings: [] })) },
}));

const SOUND: PrayerSoundKey = "athan2";
const IQAMA_SOUND: IqamaSoundKey = "beep";

const store = () => useNotificationStore.getState();
// The store's starting settings, including the seeded Maghrib iqama override.
const INITIAL_SETTINGS = store().settings;

const renderFor = (prayerId: PrayerId) => renderHook(() => usePrayerAlertSettings(prayerId));

beforeEach(() => {
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  });
});

describe("usePrayerAlertSettings", () => {
  it("returns the defaults for a prayer with no override", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);

    expect(result.current.configs).toEqual({
      [NOTIFICATION_TYPE.PRAYER]: INITIAL_SETTINGS.defaults.prayer,
      [NOTIFICATION_TYPE.IQAMA]: INITIAL_SETTINGS.defaults.iqama,
      [NOTIFICATION_TYPE.PRE_ATHAN]: INITIAL_SETTINGS.defaults.preAthan,
    });
    expect(result.current.isCustom).toBe(false);
  });

  it("shows a write on the next render", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);

    await act(() => result.current.update(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.TIMING, 20));

    expect(result.current.configs[NOTIFICATION_TYPE.IQAMA].timing).toBe(20);
  });

  it("shows an override written elsewhere", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);

    await act(() =>
      store().replaceOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND })
    );

    expect(result.current.configs[NOTIFICATION_TYPE.PRAYER].sound).toBe(SOUND);
  });

  it("keeps a sibling field when another field is written", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);

    await act(() =>
      result.current.update(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.ENABLED, true)
    );
    await act(() =>
      result.current.update(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.SOUND, IQAMA_SOUND)
    );
    await act(() => result.current.update(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.TIMING, 20));

    expect(result.current.configs[NOTIFICATION_TYPE.IQAMA]).toEqual({
      ...INITIAL_SETTINGS.defaults.iqama,
      enabled: true,
      sound: IQAMA_SOUND,
      timing: 20,
    });
  });

  it("writes only its own prayer", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);

    await act(() =>
      result.current.update(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND)
    );

    expect(Object.keys(store().settings.overrides)).toEqual([PRAYER_ID.FAJR]);
  });

  it("never writes the defaults", async () => {
    const { result } = await renderFor(PRAYER_ID.FAJR);
    const { defaults } = store().settings;

    await act(() =>
      result.current.update(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND)
    );
    await act(() => result.current.reset());

    expect(store().settings.defaults).toBe(defaults);
  });

  describe("custom tag", () => {
    it("marks a prayer custom once a field differs from the default", async () => {
      const { result } = await renderFor(PRAYER_ID.FAJR);

      await act(() =>
        result.current.update(NOTIFICATION_TYPE.PRE_ATHAN, NOTIFICATION_FIELD.ENABLED, true)
      );

      expect(result.current.isCustom).toBe(true);
    });

    it("clears the mark when the field returns to the default", async () => {
      const { enabled } = INITIAL_SETTINGS.defaults.preAthan;
      const { result } = await renderFor(PRAYER_ID.FAJR);

      await act(() =>
        result.current.update(NOTIFICATION_TYPE.PRE_ATHAN, NOTIFICATION_FIELD.ENABLED, !enabled)
      );
      await act(() =>
        result.current.update(NOTIFICATION_TYPE.PRE_ATHAN, NOTIFICATION_FIELD.ENABLED, enabled)
      );

      expect(result.current.isCustom).toBe(false);
    });

    it("ignores another prayer's override", async () => {
      await store().updateOverride(
        PRAYER_ID.ASR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );

      const { result } = await renderFor(PRAYER_ID.FAJR);

      expect(result.current.isCustom).toBe(false);
    });

    // Every install starts with this override in place.
    it("marks Maghrib custom from the seeded iqama override", async () => {
      useNotificationStore.setState({ settings: INITIAL_SETTINGS });

      const { result } = await renderFor(PRAYER_ID.MAGHRIB);

      expect(result.current.isCustom).toBe(true);
    });
  });

  describe("reset", () => {
    it("removes every type of this prayer's override", async () => {
      const { result } = await renderFor(PRAYER_ID.FAJR);
      await act(() =>
        result.current.update(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND)
      );
      await act(() =>
        result.current.update(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.TIMING, 20)
      );

      await act(() => result.current.reset());

      expect(store().settings.overrides[PRAYER_ID.FAJR]).toBeUndefined();
      expect(result.current.isCustom).toBe(false);
      expect(result.current.configs[NOTIFICATION_TYPE.PRAYER]).toEqual(
        INITIAL_SETTINGS.defaults.prayer
      );
    });

    it("leaves another prayer's override in place", async () => {
      await store().updateOverride(
        PRAYER_ID.ASR,
        NOTIFICATION_TYPE.IQAMA,
        NOTIFICATION_FIELD.TIMING,
        25
      );
      const { result } = await renderFor(PRAYER_ID.FAJR);
      await act(() =>
        result.current.update(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND)
      );

      await act(() => result.current.reset());

      expect(store().settings.overrides[PRAYER_ID.ASR]).toEqual({
        [NOTIFICATION_TYPE.IQAMA]: { timing: 25 },
      });
    });
  });
});
