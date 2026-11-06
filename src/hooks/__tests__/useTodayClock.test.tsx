import { renderHook } from "@testing-library/react-native";

import { SCREENSHOT_LOCALES, STATIC_SCREENSHOT_SCREENS } from "@/constants/Screenshot";
import { useTodayClock } from "@/hooks/useTodayClock";
import { SCREENSHOT_NOW_MS } from "@/screenshot-mode/clock";
import { useScreenshotStore } from "@/stores/screenshotStore";

let mockScreenshotMode = false;
jest.mock("@/screenshot-mode/flag", () => ({
  get IS_SCREENSHOT_MODE() {
    return mockScreenshotMode;
  },
}));

describe("useTodayClock", () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") }));
  afterEach(() => {
    jest.useRealTimers();
    mockScreenshotMode = false;
    useScreenshotStore.getState().reset();
  });

  it("reads the device clock", async () => {
    const { result } = await renderHook(() => useTodayClock());

    expect(result.current.toISOString()).toBe("2026-09-23T09:00:00.000Z");
  });

  // Every shot shows the same moment, wherever and whenever it is captured.
  it("holds the screenshot moment in a screenshot build", async () => {
    mockScreenshotMode = true;

    const { result } = await renderHook(() => useTodayClock());

    expect(result.current.getTime()).toBe(SCREENSHOT_NOW_MS);
  });

  // The sky and the Hijri date sit on screens other than Today.
  it("holds the screenshot moment while another screen is captured", async () => {
    mockScreenshotMode = true;
    useScreenshotStore.getState().setShot({
      screen: STATIC_SCREENSHOT_SCREENS[0],
      locale: SCREENSHOT_LOCALES[0],
      seed: "default",
      payload: {},
    });

    const { result } = await renderHook(() => useTodayClock());

    expect(result.current.getTime()).toBe(SCREENSHOT_NOW_MS);
  });
});
