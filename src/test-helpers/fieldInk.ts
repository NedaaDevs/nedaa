import config from "../../tamagui.config";
import { contrast, TEXT_AA } from "@/test-helpers/contrast";
import { flattenOver } from "@/utils/sky";

type Theme = (typeof config.themes)[keyof typeof config.themes];

/** A text field's typed ink, placeholder ink and fill, as drawn. */
export type FieldInk = { typed?: unknown; placeholder?: unknown; fill?: unknown };

const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

const isHex = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

/** Where a field sits: the page, a sheet over the page, a legacy panel. */
const groundsOf = (theme: Theme) => [
  theme.bg.val,
  flattenOver(theme.raised.val, theme.bg.val),
  theme.backgroundSecondary.val,
];

/** Typed text must outrank the placeholder, which must clear AA. */
export const fieldInkProblems = (ink: FieldInk, theme: Theme) => {
  const { typed, placeholder, fill } = ink;
  if (!isHex(typed) || !isHex(placeholder) || !isHex(fill)) {
    return [`not hex colours: ${JSON.stringify(ink)}`];
  }
  const boxes = new Set(groundsOf(theme).map((ground) => flattenOver(fill, ground)));
  return [...boxes].flatMap((box) => {
    const on = (colour: string) => contrast(flattenOver(colour, box), box);
    const [typedRatio, placeholderRatio] = [on(typed), on(placeholder)];
    const at = `on ${box}: placeholder ${placeholderRatio.toFixed(2)}`;
    return [
      typedRatio > placeholderRatio ? null : `${at}, typed ${typedRatio.toFixed(2)}`,
      placeholderRatio >= TEXT_AA ? null : `${at}, below ${TEXT_AA}`,
    ].filter((problem) => problem !== null);
  });
};
