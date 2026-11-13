import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TextInputProps, TextStyle } from "react-native";
import ts from "typescript";

import config from "../../tamagui.config";
import { AppMode } from "@/enums/app";
import { nodesOf, parseTsx } from "@/test-helpers/ast";
import { fieldInkProblems } from "@/test-helpers/fieldInk";
import { appSourceFiles, REPO_ROOT } from "@/test-helpers/routeTree";

type ThemeKey = keyof (typeof config.themes)["light"];

/** The theme key every field's placeholder reads. */
const PLACEHOLDER_KEY: ThemeKey = "placeholderColor";

const PLACEHOLDER_PROP: keyof TextInputProps = "placeholderTextColor";
const STYLE_PROP: keyof TextInputProps = "style";
const INK: keyof TextStyle = "color";
const FILL: keyof TextStyle = "backgroundColor";

/** The primitives, which `fieldInk.test.tsx` renders, and the Quran reader. */
const OUTSIDE = ["src/components/ui/", "src/components/quran/"];

/** Mounted only under the alarm screens' dark theme. */
const DARK_ONLY = "src/components/alarm/challenges/";

const THEMES = [AppMode.LIGHT, AppMode.DARK] as const;

type Mode = (typeof THEMES)[number];

/** The theme key a `theme.key.val` or `theme.key?.val` reads. */
const themeKeyOf = (node: ts.Node | undefined, file: ts.SourceFile) => {
  if (!node || !ts.isPropertyAccessExpression(node) || node.name.text !== "val") return undefined;
  const owner = node.expression;
  return ts.isPropertyAccessExpression(owner) && owner.expression.getText(file) === "theme"
    ? owner.name.text
    : undefined;
};

/** The theme keys of each raw field that sets a placeholder colour. */
const readFields = (text: string) => {
  const file = parseTsx(text);
  return nodesOf(file)
    .filter(ts.isJsxOpeningLikeElement)
    .flatMap((element) => {
      const props = element.attributes.properties.filter(ts.isJsxAttribute);
      const valueOf = (name: string) => {
        const value = props.find((prop) => prop.name.getText(file) === name)?.initializer;
        return value && ts.isJsxExpression(value) ? value.expression : undefined;
      };
      if (!props.some((prop) => prop.name.getText(file) === PLACEHOLDER_PROP)) return [];
      const style = valueOf(STYLE_PROP);
      const styleKey = (name: string) =>
        style && ts.isObjectLiteralExpression(style)
          ? themeKeyOf(
              style.properties
                .filter(ts.isPropertyAssignment)
                .find((prop) => prop.name.getText(file) === name)?.initializer,
              file
            )
          : undefined;
      return [
        {
          placeholder: themeKeyOf(valueOf(PLACEHOLDER_PROP), file),
          typed: styleKey(INK),
          fill: styleKey(FILL),
        },
      ];
    });
};

type RawField = ReturnType<typeof readFields>[number];

/** The app's raw fields, from the repo root. */
const FIELDS = appSourceFiles()
  .filter((path) => path.endsWith(".tsx") && !OUTSIDE.some((dir) => path.startsWith(dir)))
  .flatMap((path) => {
    const text = readFileSync(join(REPO_ROOT, path), "utf8");
    // Most files never name the prop; a parse costs far more than `includes`.
    return text.includes(PLACEHOLDER_PROP)
      ? readFields(text).map((field) => [path, field] as const)
      : [];
  });

const isThemeKey = (key: string | undefined): key is ThemeKey =>
  key !== undefined && key in config.themes.light;

/** A raw field's colours in one theme, from the keys it reads. */
const inkIn = (theme: Mode, field: RawField) => {
  const tokens = config.themes[theme];
  const valueOf = (key: string | undefined) => (isThemeKey(key) ? tokens[key].val : key);
  return {
    typed: valueOf(field.typed),
    placeholder: valueOf(field.placeholder),
    fill: valueOf(field.fill),
  };
};

describe("raw field reader", () => {
  it.each([
    [
      "<TextInput placeholderTextColor={theme.placeholderColor?.val} style={{ color: theme.fg.val, backgroundColor: theme.surface?.val }} />",
      [{ placeholder: "placeholderColor", typed: "fg", fill: "surface" }],
    ],
    [
      "<TextInput placeholderTextColor={theme.muted.val} style={{ ...(wrong && { borderWidth: 2 }), color: theme.fg.val }} />",
      [{ placeholder: "muted", typed: "fg", fill: undefined }],
    ],
    [
      '<TextInput placeholderTextColor="#999" style={[base, { color: theme.fg.val }]} />',
      [{ placeholder: undefined, typed: undefined, fill: undefined }],
    ],
    ['<TextInput placeholder="30" />', []],
  ])("reads %s", (text, fields) => {
    expect(readFields(text)).toEqual(fields);
  });
});

// A placeholder that outranks typed text reads as typed text.
describe("raw text fields", () => {
  it("finds the app's raw fields", () => {
    expect(FIELDS.length).toBeGreaterThan(3);
  });

  it.each(FIELDS)("%s reads the placeholder key", (_path, field) => {
    expect(field.placeholder).toBe(PLACEHOLDER_KEY);
  });

  it.each(FIELDS)("%s keeps typed text above its placeholder", (path, field) => {
    const themes: readonly Mode[] = path.startsWith(DARK_ONLY) ? [AppMode.DARK] : THEMES;
    const problems = themes.flatMap((theme) =>
      fieldInkProblems(inkIn(theme, field), config.themes[theme]).map((p) => `${theme} ${p}`)
    );

    expect(problems).toEqual([]);
  });
});
