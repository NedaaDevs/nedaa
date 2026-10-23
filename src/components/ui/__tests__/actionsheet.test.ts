import { readFileSync } from "fs";
import { join } from "path";

const source = () => readFileSync(join(__dirname, "../actionsheet/index.tsx"), "utf8");

describe("actionsheet", () => {
  it("lets a sheet size to its content", () => {
    expect(source()).toMatch(/enableDynamicSizing=\{fitContent\}/);
    expect(source()).toMatch(/snapPoints=\{fitContent \? undefined : points\}/);
  });

  // Percentage-only detents cannot express a content height or a pixel stop.
  it("passes a string detent through untouched", () => {
    expect(source()).toMatch(/typeof n === "number" \? `\$\{n\}%` : n/);
  });

  it("lets content opt out of the fixed insets", () => {
    expect(source()).toMatch(/unpadded\s*\?\s*undefined\s*:/);
  });
});
