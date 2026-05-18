import { useScreenshotStore } from "@/stores/screenshotStore";
import { selectScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

beforeEach(() => useScreenshotStore.getState().reset());

describe("selectScreenshotSeed", () => {
  test("returns null when no shot is active", () => {
    expect(selectScreenshotSeed(useScreenshotStore.getState(), "prayer-times")).toBeNull();
  });

  test("returns null when the active shot is a different screen", () => {
    useScreenshotStore.getState().setShot({
      screen: "qibla",
      locale: "en",
      seed: "test",
      payload: { foo: 1 },
    });
    expect(selectScreenshotSeed(useScreenshotStore.getState(), "prayer-times")).toBeNull();
  });

  test("returns the payload when the active shot matches", () => {
    useScreenshotStore.getState().setShot({
      screen: "prayer-times",
      locale: "en",
      seed: "makkah-dhuhr-2h14m",
      payload: { city: "Madinah" },
    });
    expect(selectScreenshotSeed(useScreenshotStore.getState(), "prayer-times")).toEqual({
      city: "Madinah",
    });
  });
});
