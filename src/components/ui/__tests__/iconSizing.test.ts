import { readFileSync } from "fs";
import { join } from "path";

import { ICON_SIZES, resolveIconSize } from "@/components/ui/icon/sizing";

const source = (name: string) => readFileSync(join(__dirname, `../${name}/index.tsx`), "utf8");

/** Each primitive's icon ramp, as step names rather than pixels. */
const RAMPS = {
  button: { xs: "xs", sm: "sm", md: "md", lg: "md", xl: "lg" },
  fab: { sm: "md", md: "lg", lg: "xl" },
  badge: { sm: "2xs", md: "xs", lg: "sm" },
} as const;

describe("icon sizing", () => {
  it("resolves a name through the ramp and passes a number through", () => {
    expect(resolveIconSize("md")).toBe(ICON_SIZES.md);
    expect(resolveIconSize(37)).toBe(37);
  });

  it("falls back to md rather than undefined", () => {
    expect(resolveIconSize("nope" as never)).toBe(ICON_SIZES.md);
  });

  // The ramp climbs, or a larger name would render a smaller glyph.
  it("climbs from 2xs to 3xl", () => {
    const steps = Object.values(ICON_SIZES);

    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it("carries sizes above 24", () => {
    expect(Math.max(...Object.values(ICON_SIZES))).toBeGreaterThan(24);
  });

  describe.each(Object.entries(RAMPS))("%s", (name, ramp) => {
    // A primitive naming a step keeps one source for the geometry.
    it("names a step for every size", () => {
      const declared = [...source(name).matchAll(/^\s{2}"?([\w-]+)"?: "([\w]+)",$/gm)];
      const found = Object.fromEntries(declared.map((m) => [m[1], m[2]]));

      for (const [size, step] of Object.entries(ramp)) expect(found[size]).toBe(step);
    });

    it("names only steps the ramp declares", () => {
      for (const step of Object.values(ramp)) expect(ICON_SIZES).toHaveProperty(step);
    });
  });
});
