import { readFileSync } from "fs";
import { join, relative, sep } from "path";
import { tokenCategories } from "@tamagui/helpers";

import config from "../../tamagui.config";
import {
  countBoundary,
  type BoundaryCounts,
  type BoundaryVocabulary,
} from "@/test-helpers/designSystemBoundary";
import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";

/**
 * How far screens reach past `src/components/ui`. Each ceiling is the count on the
 * tree today: a change that adds one fails, and a change that removes one lowers
 * the ceiling in the same commit. Raising a ceiling is a design decision.
 */
const CEILING = {
  /** Files importing any value from `tamagui` or `@tamagui/*`. */
  tamaguiValueImporters: 52,
  /** `useTheme()` calls on Tamagui's hook. */
  useThemeCalls: 27,
  /** Radius props not set to a named token ($chip, $control, $card, $sheet, $pill). */
  rawRadius: 385,
  /** Width, height and their bounds given a non-zero number. */
  rawSize: 591,
  /** `styled()` belongs in `ui/`, and nowhere else ever. */
  styledCalls: 0,
} as const;

type Bucket = keyof typeof CEILING;

const radiusLongNames = Object.keys(tokenCategories.radius);

const VOCABULARY: BoundaryVocabulary = {
  radiusProps: new Set([
    ...radiusLongNames,
    ...Object.entries(config.shorthands)
      .filter(([, longName]) => radiusLongNames.includes(longName))
      .map(([shorthand]) => shorthand),
  ]),
  namedRadii: new Set(
    Object.keys(config.tokens.radius)
      .filter((key) => !/^\d+$/.test(key) && key !== "true")
      .map((key) => `$${key}`)
  ),
  sizeProps: new Set(Object.keys(tokenCategories.size)),
};

const count = (source: string, fileName = "fixture.tsx") =>
  countBoundary(fileName, source, VOCABULARY);

describe("design-system boundary", () => {
  // The counter reads a syntax tree; these pin that it reads the right nodes.
  describe("counter", () => {
    it.each([
      ['import { YStack } from "tamagui";', true],
      ['import * as T from "tamagui";', true],
      ['import { Sheet } from "@tamagui/sheet";', true],
      ['import type { GetProps } from "tamagui";', false],
      ['import { type GetProps } from "tamagui";', false],
      ['import { YStack } from "@/components/ui/vstack";', false],
    ])("%s imports a Tamagui value: %s", (source, expected) => {
      expect(count(source).importsTamaguiValue).toBe(expected);
    });

    it("counts Tamagui's useTheme, aliased or not, and no other", () => {
      const source = `
        import { useTheme, useTheme as theme } from "tamagui";
        import { useTheme as navTheme } from "somewhere-else";
        useTheme(); theme(); navTheme();`;

      expect(count(source).useThemeCalls).toBe(2);
    });

    it("counts the app's live useTheme as Tamagui's", () => {
      const source = `
        import { useTheme } from "@/components/ui/theme-color";
        useTheme();`;

      expect(count(source).useThemeCalls).toBe(1);
    });

    it.each([
      ['<Box borderRadius="$card" />', 0],
      ['<Box br="$pill" rounded="$chip" />', 0],
      ['<Box borderRadius={on ? "$card" : "$control"} />', 0],
      ["<Box borderRadius={12} />", 1],
      ['<Box borderRadius="$4" />', 1],
      ['<Box borderRadius={on ? "$card" : 8} />', 1],
      ["<Box borderTopLeftRadius={radius} />", 1],
      ["const s = { borderRadius: 16 };", 1],
      ["// <Box borderRadius={12} />", 0],
      ['const note = "borderRadius={12}";', 0],
    ])("%s holds %i raw radius", (source, expected) => {
      expect(count(source).rawRadius).toBe(expected);
    });

    it.each([
      ["<Box width={24} />", 1],
      ["<Box width={0} height={-1} />", 1],
      ['<Box width="100%" />', 0],
      ['<Box width="$target" />', 0],
      ["<Box minHeight={big ? 56 : 44} />", 1],
      ["const s = { maxWidth: 560 };", 1],
      ["<Box padding={12} />", 0],
    ])("%s holds %i raw size", (source, expected) => {
      expect(count(source).rawSize).toBe(expected);
    });

    it("counts styled() only when it comes from Tamagui", () => {
      const source = `
        import { styled } from "tamagui";
        import { styled as css } from "styled-components";
        styled(View, {}); css.div\`\`;`;

      expect(count(source).styledCalls).toBe(1);
    });
  });

  describe("tree", () => {
    const skipped = ["__tests__", "test-helpers"];
    const files = walkFiles(join(REPO_ROOT, "src")).filter((path) => {
      const parts = relative(REPO_ROOT, path).split(sep);
      return (
        /\.tsx?$/.test(path) &&
        !path.endsWith(".d.ts") &&
        !parts.some((part) => skipped.includes(part)) &&
        !parts.join("/").startsWith("src/components/ui/")
      );
    });

    const totals: Record<Bucket, number> = {
      tamaguiValueImporters: 0,
      useThemeCalls: 0,
      rawRadius: 0,
      rawSize: 0,
      styledCalls: 0,
    };
    for (const path of files) {
      const found: BoundaryCounts = countBoundary(path, readFileSync(path, "utf8"), VOCABULARY);
      if (found.importsTamaguiValue) totals.tamaguiValueImporters += 1;
      totals.useThemeCalls += found.useThemeCalls;
      totals.rawRadius += found.rawRadius;
      totals.rawSize += found.rawSize;
      totals.styledCalls += found.styledCalls;
    }

    it("reads the source tree", () => {
      expect(files.length).toBeGreaterThan(400);
    });

    it.each(Object.keys(CEILING) as Bucket[])("%s does not rise", (bucket) => {
      expect(totals[bucket]).toBeLessThanOrEqual(CEILING[bucket]);
    });

    // A ratchet only holds if a paid-down count takes its ceiling with it.
    it.each(Object.keys(CEILING) as Bucket[])("%s ceiling matches the tree", (bucket) => {
      expect(CEILING[bucket]).toBe(totals[bucket]);
    });
  });
});
