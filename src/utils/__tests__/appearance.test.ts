import { NATIVE_SCHEME } from "@/constants/Appearance";
import { isDarkMode, nativeColorSchemeFor } from "@/utils/appearance";
import { AppMode } from "@/enums/app";
import { PHASE, type Phase } from "@/constants/Phase";

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
    [AppMode.SYSTEM, null, false],
  ])("%s with the phone on %s is dark: %s", (mode, systemScheme, expected) => {
    expect(isDarkMode(mode, systemScheme)).toBe(expected);
  });
});

describe("Adaptive", () => {
  const DARK_PHASES: readonly Phase[] = [PHASE.MAGHRIB, PHASE.NIGHT];
  const PHONE = [NATIVE_SCHEME.LIGHT, NATIVE_SCHEME.DARK];

  // Maghrib and night draw dark whatever the phone says, and the keyboard follows.
  describe.each(Object.values(PHASE))("in %s", (phase) => {
    const dark = DARK_PHASES.includes(phase);

    it.each(PHONE)("draws dark: %s phone", (scheme) => {
      expect(isDarkMode(AppMode.ADAPTIVE, scheme, phase)).toBe(dark);
    });

    it("pins the native scheme the app draws in", () => {
      expect(nativeColorSchemeFor(AppMode.ADAPTIVE, phase)).toBe(
        dark ? NATIVE_SCHEME.DARK : NATIVE_SCHEME.LIGHT
      );
    });
  });

  // No prayer times yet, as on a fresh install before location resolves.
  it.each(PHONE)("follows a %s phone until it knows the phase", (scheme) => {
    expect(isDarkMode(AppMode.ADAPTIVE, scheme, undefined)).toBe(
      isDarkMode(AppMode.SYSTEM, scheme)
    );
    expect(nativeColorSchemeFor(AppMode.ADAPTIVE, undefined)).toBe(NATIVE_SCHEME.UNSPECIFIED);
  });
});
