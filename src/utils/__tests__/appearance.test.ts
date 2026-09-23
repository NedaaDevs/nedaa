import { isDarkMode, NATIVE_SCHEME, nativeColorSchemeFor } from "@/utils/appearance";
import { AppMode } from "@/enums/app";

describe("nativeColorSchemeFor", () => {
  it("pins explicit light/dark so native surfaces can't follow the OS", () => {
    expect(nativeColorSchemeFor(AppMode.LIGHT)).toBe(NATIVE_SCHEME.LIGHT);
    expect(nativeColorSchemeFor(AppMode.DARK)).toBe(NATIVE_SCHEME.DARK);
  });

  it("hands control back to the OS for system mode", () => {
    expect(nativeColorSchemeFor(AppMode.SYSTEM)).toBe(NATIVE_SCHEME.UNSPECIFIED);
  });
});

describe("isDarkMode", () => {
  it.each([
    [AppMode.DARK, NATIVE_SCHEME.LIGHT, true],
    [AppMode.LIGHT, NATIVE_SCHEME.DARK, false],
    [AppMode.SYSTEM, NATIVE_SCHEME.DARK, true],
    [AppMode.SYSTEM, NATIVE_SCHEME.LIGHT, false],
    [AppMode.SYSTEM, NATIVE_SCHEME.UNSPECIFIED, false],
  ])("%s with the phone on %s is dark: %s", (mode, systemScheme, expected) => {
    expect(isDarkMode(mode, systemScheme)).toBe(expected);
  });
});
