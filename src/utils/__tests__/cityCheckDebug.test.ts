import { Alert } from "react-native";

import { CITY_CHECK_END, CITY_CHECK_TRIGGER } from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { runCityCheck } from "@/services/cityCheck";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { clearCityCheckMemory, runCityCheckNow, showCityCheckMemory } from "@/utils/cityCheckDebug";

jest.mock("@/services/cityCheck", () => {
  const { CITY_CHECK_END: END } = jest.requireActual("@/constants/CityCheck");
  return { runCityCheck: jest.fn(() => Promise.resolve({ reason: END.NOT_MOVED })) };
});

const MINUTE_MS = 60_000;
const NOW = 1_800_000_000_000;
const alertBody = () => jest.mocked(Alert.alert).mock.lastCall?.[1] ?? "";

beforeEach(() => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(runCityCheck).mockClear();
});

describe("runCityCheckNow", () => {
  it("forgets the last check, then runs a launch check past the throttle", async () => {
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, lastCheckAt: NOW } });
    jest.mocked(runCityCheck).mockImplementationOnce(() => {
      expect(useCityCheckStore.getState().cityCheck.lastCheckAt).toBeNull();
      return Promise.resolve({ reason: CITY_CHECK_END.NOT_MOVED });
    });

    await runCityCheckNow();

    expect(runCityCheck).toHaveBeenCalledWith(CITY_CHECK_TRIGGER.LAUNCH);
  });
});

describe("showCityCheckMemory", () => {
  it("shows counts and ages, with no coordinates", () => {
    useCityCheckStore.setState({
      cityCheck: {
        lastCheckAt: NOW - 5 * MINUTE_MS,
        lastPhoneZone: "Asia/Riyadh",
        kept: [{ lat: 21.54331, lng: 39.17284, at: NOW - 120 * MINUTE_MS }],
        notAsked: [],
      },
    });

    showCityCheckMemory();

    const body = alertBody();
    expect(jest.mocked(Alert.alert).mock.lastCall?.[0]).toBe(DEBUG_COPY.SHOW_CITY_CHECK_MEMORY);
    expect(body).toMatch(/kept: 1/);
    expect(body).toMatch(/notAsked: 0/);
    expect(body).toContain("5 min");
    expect(body).toContain("2 h");
    expect(body).toContain("Asia/Riyadh");
    expect(body).not.toMatch(/\d+\.\d{2}/);
  });

  it("says never for a memory that has no check", () => {
    showCityCheckMemory();

    expect(alertBody()).toContain(DEBUG_COPY.NEVER_CHECKED);
    expect(alertBody()).toContain(DEBUG_COPY.NO_ZONE);
  });
});

describe("clearCityCheckMemory", () => {
  it("empties the memory", () => {
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, lastPhoneZone: "Asia/Riyadh" } });

    clearCityCheckMemory();

    expect(useCityCheckStore.getState().cityCheck).toEqual(EMPTY_MEMORY);
  });
});
