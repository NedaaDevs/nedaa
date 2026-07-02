import { nativeColorSchemeFor } from "@/utils/appearance";
import { AppMode } from "@/enums/app";

describe("nativeColorSchemeFor", () => {
  it("pins explicit light/dark so native surfaces can't follow the OS", () => {
    expect(nativeColorSchemeFor(AppMode.LIGHT)).toBe("light");
    expect(nativeColorSchemeFor(AppMode.DARK)).toBe("dark");
  });

  it("hands control back to the OS for system mode", () => {
    expect(nativeColorSchemeFor(AppMode.SYSTEM)).toBe("unspecified");
  });
});
