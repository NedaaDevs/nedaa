import { renderHook } from "@testing-library/react-native";

import { useTodayClock } from "@/hooks/useTodayClock";
import { prayerTimesPresets } from "@/screenshot-mode/presets/prayer-times";
import { useScreenshotStore } from "@/stores/screenshotStore";

const SEED = Object.values(prayerTimesPresets)[0];

describe("useTodayClock", () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") }));
  afterEach(() => {
    jest.useRealTimers();
    useScreenshotStore.setState({ screen: null, payload: null });
  });

  it("reads the device clock", async () => {
    const { result } = await renderHook(() => useTodayClock());

    expect(result.current.toISOString()).toBe("2026-09-23T09:00:00.000Z");
  });

  // Every store shot of Today shows the same moment, wherever it is captured.
  it("holds the seeded moment during a screenshot", async () => {
    useScreenshotStore.setState({ screen: "prayer-times", payload: SEED });

    const { result } = await renderHook(() => useTodayClock());

    expect(result.current.getTime()).toBe(SEED.frozenNow);
  });
});
