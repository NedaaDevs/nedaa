import { presets, getPreset } from "@/screenshot-mode/presets";

describe("preset registry", () => {
  test("prayer-times has the makkah-dhuhr-2h14m preset", () => {
    const preset = getPreset("prayer-times", "makkah-dhuhr-2h14m");
    expect(preset).not.toBeNull();
    expect(preset?.location.city).toBe("Makkah");
  });

  test("getPreset returns null for unknown seed", () => {
    expect(getPreset("prayer-times", "no-such-seed")).toBeNull();
  });

  test("every preset zod-validates at module load", () => {
    expect(Object.keys(presets["prayer-times"]).length).toBeGreaterThan(0);
  });

  test("tools has the navigate-only default preset", () => {
    expect(getPreset("tools", "default")).toEqual({ focus: "overview" });
  });

  test("umrah seeds a mid-journey position (2 of 4 stages)", () => {
    const preset = getPreset("umrah", "sai-2-of-4");
    expect(preset).toEqual({ stageIndex: 2, stepIndex: 1 });
  });
});
