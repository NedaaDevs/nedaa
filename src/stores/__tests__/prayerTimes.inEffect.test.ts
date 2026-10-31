import { reloadPrayerWidgets } from "expo-widget";

import { TIMES_FETCH } from "@/constants/PrayerTimes";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { syncWidgetSnapshot } from "@/services/widgetSnapshot";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { AppLogger } from "@/utils/appLogger";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const MAKKAH = ALADHAN.methods.find((m) => m.nameKey === "makkah")!.id;
const MWL = ALADHAN.methods.find((m) => m.nameKey === "mwl")!.id;

const mockGet = jest.fn();
const mockInsert = jest.fn();

jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    insertPrayerTimes: (...args: unknown[]) => mockInsert(...args),
    cleanData: async () => true,
  },
}));
jest.mock("@/api/prayerTimes.api", () => ({
  prayerTimesApi: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock("@/adapters/providers", () => ({
  getAdapterByProviderId: () => ({
    toParams: () => ({ lat: 0, lng: 0, year: 2026 }),
    fromApplied: (raw: unknown) =>
      jest.requireActual("@/utils/providers/aladhan").parseAladhanApplied(raw),
  }),
}));
jest.mock("@/utils/location", () => ({ checkLocationPermission: jest.fn() }));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("expo-widgets", () => ({ refreshAllWidgets: jest.fn() }));

const response = (applied?: unknown) => ({
  success: true,
  data: {
    timezone: "Asia/Riyadh",
    coordinates: { lat: 0, lng: 0 },
    provider: ALADHAN.id,
    months: {},
    applied,
  },
});

describe("the settings the stored times came from", () => {
  const { locationDetails } = useLocationStore.getState();

  beforeEach(() => {
    jest.clearAllMocks();
    useProviderSettingsStore.setState({ inEffect: null });
    mockInsert.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    useLocationStore.setState({ locationDetails });
  });

  it("keeps what the provider reports once the times are stored", async () => {
    mockGet.mockResolvedValue(response({ method: MAKKAH }));

    await usePrayerTimesStore.getState().getAndStorePrayerTimes();

    expect(useProviderSettingsStore.getState().inEffect).toEqual({ method: MAKKAH });
  });

  it("forgets the last report when a response carries none", async () => {
    useProviderSettingsStore.setState({ inEffect: { method: MAKKAH } });
    mockGet.mockResolvedValue(response());

    await usePrayerTimesStore.getState().getAndStorePrayerTimes();

    expect(useProviderSettingsStore.getState().inEffect).toBeNull();
  });

  // An adjacent year's fetch holds no part of today, so its report is not today's.
  it("keeps the report when an adjacent year's fetch carries none", async () => {
    useProviderSettingsStore.setState({ inEffect: { method: MAKKAH } });
    mockGet.mockResolvedValue(response());

    await usePrayerTimesStore.getState().getAndStorePrayerTimes(2027);

    expect(useProviderSettingsStore.getState().inEffect).toEqual({ method: MAKKAH });
  });

  // The move's own load fetches the new place's times and their report.
  it("writes nothing when the place moves while the fetch is out", async () => {
    useProviderSettingsStore.setState({ inEffect: { method: MWL } });
    mockGet.mockImplementation(async () => {
      // A write of a new point, as every place writer makes it.
      useLocationStore.setState((state) => ({
        locationDetails: {
          ...locationDetails,
          coords: { ...locationDetails.coords, latitude: locationDetails.coords.latitude + 1 },
        },
        placeRevision: state.placeRevision + 1,
      }));
      return response({ method: MAKKAH });
    });

    await expect(usePrayerTimesStore.getState().getAndStorePrayerTimes()).resolves.toBe(
      TIMES_FETCH.SUPERSEDED
    );

    expect(mockInsert).not.toHaveBeenCalled();
    expect(useProviderSettingsStore.getState().inEffect).toEqual({ method: MWL });
    expect(reloadPrayerWidgets).not.toHaveBeenCalled();
    expect(syncWidgetSnapshot).not.toHaveBeenCalled();
  });

  it("keeps the last report when the times fail to store", async () => {
    useProviderSettingsStore.setState({ inEffect: { method: MWL } });
    mockGet.mockResolvedValue(response({ method: MAKKAH }));
    mockInsert.mockResolvedValue({ success: false });

    await usePrayerTimesStore.getState().getAndStorePrayerTimes();

    expect(useProviderSettingsStore.getState().inEffect).toEqual({ method: MWL });
  });
});

describe("a failed fetch's log", () => {
  afterEach(() => jest.restoreAllMocks());

  // The API client resolves a failed request as a response, not an Error.
  it("keeps the message of the response the API failed with", async () => {
    const logError = jest.spyOn(AppLogger.create("prayertimes"), "e");
    mockGet.mockResolvedValue({ success: false, message: "Network Error" });

    await expect(usePrayerTimesStore.getState().getAndStorePrayerTimes(2027)).resolves.toBe(
      TIMES_FETCH.FAILED
    );

    expect(logError).toHaveBeenCalledWith(
      "Fetch",
      "prayer times fetch failed (2027/all)",
      expect.objectContaining({ message: "Network Error" })
    );
  });
});
