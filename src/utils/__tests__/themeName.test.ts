import { ThemeName, resolveThemeName, isDarkTheme } from "@/utils/appearance";
import { AppMode } from "@/enums/app";

describe("resolveThemeName", () => {
  it("follows the OS scheme in system mode", () => {
    expect(resolveThemeName(AppMode.SYSTEM, "dark", false)).toBe(ThemeName.DARK);
    expect(resolveThemeName(AppMode.SYSTEM, "light", false)).toBe(ThemeName.LIGHT);
  });

  it("pins the theme when the user picked light or dark explicitly", () => {
    expect(resolveThemeName(AppMode.DARK, "light", false)).toBe(ThemeName.DARK);
    expect(resolveThemeName(AppMode.LIGHT, "dark", false)).toBe(ThemeName.LIGHT);
  });

  it("keeps light/dark working under Classic — it is a palette, not a mode", () => {
    expect(resolveThemeName(AppMode.DARK, "light", true)).toBe(ThemeName.CLASSIC_DARK);
    expect(resolveThemeName(AppMode.LIGHT, "dark", true)).toBe(ThemeName.CLASSIC_LIGHT);
    expect(resolveThemeName(AppMode.SYSTEM, "dark", true)).toBe(ThemeName.CLASSIC_DARK);
    expect(resolveThemeName(AppMode.SYSTEM, "light", true)).toBe(ThemeName.CLASSIC_LIGHT);
  });

  it("treats an unknown OS scheme as light", () => {
    expect(resolveThemeName(AppMode.SYSTEM, null, false)).toBe(ThemeName.LIGHT);
    expect(resolveThemeName(AppMode.SYSTEM, null, true)).toBe(ThemeName.CLASSIC_LIGHT);
  });
});

describe("isDarkTheme", () => {
  it("recognises both dark palettes, so chrome can't end up light-on-light", () => {
    expect(isDarkTheme(ThemeName.DARK)).toBe(true);
    expect(isDarkTheme(ThemeName.CLASSIC_DARK)).toBe(true);
  });

  it("recognises both light palettes", () => {
    expect(isDarkTheme(ThemeName.LIGHT)).toBe(false);
    expect(isDarkTheme(ThemeName.CLASSIC_LIGHT)).toBe(false);
  });
});
