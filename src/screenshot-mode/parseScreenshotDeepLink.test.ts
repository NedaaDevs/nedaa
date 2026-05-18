import { parseScreenshotDeepLink } from "@/screenshot-mode/parseScreenshotDeepLink";

describe("parseScreenshotDeepLink", () => {
  test("parses a valid deep link", () => {
    const result = parseScreenshotDeepLink(
      "nedaa://screenshot/prayer-times?locale=en&seed=makkah-dhuhr-2h14m"
    );
    expect(result).toEqual({
      screen: "prayer-times",
      locale: "en",
      seed: "makkah-dhuhr-2h14m",
    });
  });

  test("returns null for non-screenshot scheme", () => {
    expect(parseScreenshotDeepLink("nedaa://alarm/ring")).toBeNull();
  });

  test("returns null for unknown screen", () => {
    expect(parseScreenshotDeepLink("nedaa://screenshot/typo?locale=en&seed=x")).toBeNull();
  });

  test("returns null for missing locale", () => {
    expect(parseScreenshotDeepLink("nedaa://screenshot/prayer-times?seed=x")).toBeNull();
  });

  test("returns null for invalid locale", () => {
    expect(parseScreenshotDeepLink("nedaa://screenshot/prayer-times?locale=fr&seed=x")).toBeNull();
  });
});
