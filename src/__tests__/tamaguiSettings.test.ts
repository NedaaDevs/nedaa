import config from "../../tamagui.config";

describe("tamagui settings", () => {
  // The fast path hands iOS colours that follow the phone's appearance, and
  // Adaptive, Light and Dark can each differ from it.
  it("resolves colours from the app's theme, not the phone's", () => {
    expect(config.settings.fastSchemeChange).toBe(false);
  });
});
