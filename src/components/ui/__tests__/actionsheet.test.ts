import { readFileSync } from "fs";
import { join } from "path";

const source = () => readFileSync(join(__dirname, "../actionsheet/index.tsx"), "utf8");

describe("actionsheet", () => {
  it("lets a sheet size to its content", () => {
    expect(source()).toMatch(/enableDynamicSizing=\{fitContent\}/);
    expect(source()).toMatch(/snapPoints=\{fitContent \? undefined : points\}/);
  });

  it("lets content opt out of the fixed insets", () => {
    expect(source()).toMatch(/unpadded\s*\?\s*undefined\s*:/);
  });
});
