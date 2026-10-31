import { BRIGHTNESS } from "@/constants/Palette";
import { CONTACT_SHADOW, ELEVATION, ELEVATION_LEVEL } from "@/constants/Elevation";

describe("elevation", () => {
  it("holds every level, in order", () => {
    expect(Object.keys(ELEVATION)).toEqual(Object.values(ELEVATION_LEVEL));
  });

  // A part lifted inside a track takes only e2's tight layer.
  it.each(Object.values(BRIGHTNESS))("the contact shadow is e2's first layer (%s)", (theme) => {
    const [first, second] = String(ELEVATION[ELEVATION_LEVEL.E2].boxShadow[theme]).split(", 0 ");

    expect(CONTACT_SHADOW[theme]).toBe(first);
    expect(second).toBeDefined();
  });

  it("e0 draws no shadow in either theme", () => {
    expect(ELEVATION.e0.boxShadow).toEqual({ light: null, dark: null });
  });

  it("e1 light is two layers on the light shadow hue", () => {
    expect(ELEVATION.e1.boxShadow.light).toBe(
      "0 1px 2px rgba(7, 23, 39, 0.06), 0 6px 16px rgba(7, 23, 39, 0.06)"
    );
  });

  it("e1 dark is two layers on the dark shadow hue", () => {
    expect(ELEVATION.e1.boxShadow.dark).toBe(
      "0 1px 2px rgba(0, 0, 2, 0.3), 0 6px 16px rgba(0, 0, 2, 0.28)"
    );
  });

  it("e2 states its float layers per theme", () => {
    expect(ELEVATION.e2.boxShadow.light).toBe(
      "0 2px 4px rgba(7, 23, 39, 0.08), 0 12px 32px rgba(7, 23, 39, 0.12)"
    );
    expect(ELEVATION.e2.boxShadow.dark).toBe(
      "0 2px 4px rgba(0, 0, 2, 0.35), 0 12px 32px rgba(0, 0, 2, 0.45)"
    );
  });

  it("e3 casts upward in both themes", () => {
    expect(ELEVATION.e3.boxShadow.light).toBe(
      "0 -8px 24px rgba(7, 23, 39, 0.1), 0 -24px 64px rgba(7, 23, 39, 0.18)"
    );
    expect(ELEVATION.e3.boxShadow.dark).toBe(
      "0 -8px 24px rgba(0, 0, 2, 0.35), 0 -24px 64px rgba(0, 0, 2, 0.55)"
    );
  });
});
