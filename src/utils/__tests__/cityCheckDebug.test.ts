import { Alert } from "react-native";

import {
  CITY_CHECK_END,
  CITY_CHECK_OFFER,
  CITY_CHECK_TRIGGER,
  CITY_ROW_TRUST_KM,
} from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { runCityCheck } from "@/services/cityCheck";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { JEDDAH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import {
  clearCityCheckMemory,
  runCityCheckNow,
  showCityCheckMemory,
  showNamedCityChange,
} from "@/utils/cityCheckDebug";
import { distanceBetween } from "@/utils/location";

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

  it("shows the end reason of a check that made no offer", async () => {
    await runCityCheckNow();

    expect(Alert.alert).toHaveBeenCalledWith(DEBUG_COPY.RUN_CITY_CHECK, CITY_CHECK_END.NOT_MOVED);
  });

  it("shows that a check made an offer", async () => {
    jest.mocked(runCityCheck).mockResolvedValueOnce({ offered: [CITY_CHECK_OFFER.SHIFT] });

    await runCityCheckNow();

    expect(Alert.alert).toHaveBeenCalledWith(DEBUG_COPY.RUN_CITY_CHECK, DEBUG_COPY.OFFERED);
  });
});

describe("showCityCheckMemory", () => {
  it("shows counts and ages, with no coordinates", () => {
    useCityCheckStore.setState({
      cityCheck: {
        lastCheckAt: NOW - 5 * MINUTE_MS,
        lastPhoneZone: RIYADH_ZONE,
        kept: [{ lat: 21.54331, lng: 39.17284, at: NOW - 120 * MINUTE_MS }],
        notAsked: [],
      },
    });

    showCityCheckMemory();

    const body = alertBody();
    expect(jest.mocked(Alert.alert).mock.lastCall?.[0]).toBe(DEBUG_COPY.SHOW_CITY_CHECK_MEMORY);
    expect(body).toContain(`${DEBUG_COPY.KEPT}: 1`);
    expect(body).toContain(`${DEBUG_COPY.NOT_ASKED}: 0`);
    expect(body).toContain(`5 ${DEBUG_COPY.MINUTES}`);
    expect(body).toContain(`2 ${DEBUG_COPY.HOURS}`);
    expect(body).toContain(RIYADH_ZONE);
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
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, lastPhoneZone: RIYADH_ZONE } });

    clearCityCheckMemory();

    expect(useCityCheckStore.getState().cityCheck).toEqual(EMPTY_MEMORY);
    expect(Alert.alert).toHaveBeenCalledWith(
      DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY,
      DEBUG_COPY.CLEARED
    );
  });
});

describe("showNamedCityChange", () => {
  it("offers a point farther from Jeddah than a city row is trusted", () => {
    showNamedCityChange();

    const point = useLocationStore.getState().cityOffer?.candidate.point;
    expect(point).toBeDefined();
    expect(distanceBetween(point!, JEDDAH_CITY)).toBeGreaterThan(CITY_ROW_TRUST_KM);
  });
});
