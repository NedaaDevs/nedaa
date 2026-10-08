import { LocationMode } from "@/enums/location";
import { SCREENSHOT_LOCALES } from "@/constants/Screenshot";
import { seedScreenshotState } from "@/screenshot-mode/seedScreenshotState";
import { useLocationStore } from "@/stores/location";

jest.mock("@/screenshot-mode/flag", () => ({ IS_SCREENSHOT_MODE: true }));

// A device position would open the system location dialog over the captured screen.
it("seeds the city as a manual pick, so nothing reads the device position", () => {
  useLocationStore.setState({ locationMode: LocationMode.DEVICE });

  seedScreenshotState(SCREENSHOT_LOCALES[0]);

  expect(useLocationStore.getState().locationMode).toBe(LocationMode.MANUAL);
});

// The first prayer-time load can run before the deep link seeds the city.
it("starts a screenshot build in manual mode", () => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLocationStore: freshStore } = require("@/stores/location");
    expect(freshStore.getState().locationMode).toBe(LocationMode.MANUAL);
  });
});

// A saved DEVICE mode is restored after the first render and must not win.
it("keeps manual mode when saved state is restored in a screenshot build", () => {
  const { merge } = useLocationStore.persist.getOptions();
  const current = useLocationStore.getState();

  const restored = merge?.({ locationMode: LocationMode.DEVICE }, current);

  expect(restored?.locationMode).toBe(LocationMode.MANUAL);
});
