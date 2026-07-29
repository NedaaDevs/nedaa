import { useLocationStore } from "@/stores/location";
import { LocationMode } from "@/enums/location";
import { initialLocationDetails, type ManualLocation } from "@/types/location";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const LAHORE: ManualLocation = {
  cityId: 1172451,
  name: "Lahore",
  names: { ar: "لاهور", ur: "لاھور", ms: "Lahore" },
  region: { code: "04", name: "Punjab", names: { ar: "البنجاب", ur: "پنجاب", ms: null } },
  countryCode: "PK",
  country: { name: "Pakistan", names: { ar: "باكستان", ur: "پاکستان", ms: "Pakistan" } },
  latitude: 31.558,
  longitude: 74.35071,
  timezone: "Asia/Karachi",
};

describe("manual location", () => {
  beforeEach(() => {
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
      lastKnownCoords: null,
      locationDetails: initialLocationDetails,
      localizedLocation: { country: "", city: "" },
    });
  });

  test("setManualLocation switches to manual mode and stores the city", () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    expect(useLocationStore.getState().locationMode).toBe(LocationMode.MANUAL);
    expect(useLocationStore.getState().manualLocation).toEqual(LAHORE);
  });

  test("setManualLocation writes coordinates and timezone into locationDetails", () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    const { locationDetails } = useLocationStore.getState();

    expect(locationDetails.coords.latitude).toBe(31.558);
    expect(locationDetails.coords.longitude).toBe(74.35071);
    expect(locationDetails.timezone).toBe("Asia/Karachi");
  });

  test("setManualLocation sets lastKnownCoords so the default-location fallback clears", () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: 31.558,
      longitude: 74.35071,
    });
  });

  test("setManualLocation reports no accuracy, because a chosen city is not a measured fix", () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    expect(useLocationStore.getState().locationDetails.coords.accuracy).toBeNull();
  });

  test("setManualLocation clears any previous location error", () => {
    useLocationStore.setState({
      locationDetails: { ...initialLocationDetails, error: "Location request timed out" },
    });

    useLocationStore.getState().setManualLocation(LAHORE);
    expect(useLocationStore.getState().locationDetails.error).toBeNull();
  });

  test("setManualLocation fills localizedLocation for display", () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    expect(useLocationStore.getState().localizedLocation).toEqual({
      city: "Lahore",
      country: "Pakistan",
    });
  });

  test("setManualLocation replaces a previously chosen city", () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    const riyadh: ManualLocation = {
      ...LAHORE,
      cityId: 108410,
      name: "Riyadh",
      latitude: 24.68773,
      longitude: 46.72185,
      timezone: "Asia/Riyadh",
    };

    useLocationStore.getState().setManualLocation(riyadh);
    expect(useLocationStore.getState().manualLocation?.name).toBe("Riyadh");
    expect(useLocationStore.getState().locationDetails.timezone).toBe("Asia/Riyadh");
  });

  test("clearManualLocation returns to device mode and drops the saved city", () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    useLocationStore.getState().clearManualLocation();

    expect(useLocationStore.getState().locationMode).toBe(LocationMode.DEVICE);
    expect(useLocationStore.getState().manualLocation).toBeNull();
  });

  test("clearManualLocation drops lastKnownCoords so a device fix is required again", () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    useLocationStore.getState().clearManualLocation();

    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
  });
});
