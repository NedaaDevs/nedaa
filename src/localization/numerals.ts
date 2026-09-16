import type { PostProcessorModule } from "i18next";
import { usePreferencesStore } from "@/stores/preferences";
import { localizeDigits } from "@/utils/digits";

// Keys whose Western digits are part of the text rather than a quantity, so the
// numeral preference must not reach them.
export const LITERAL_DIGIT_KEYS = [
  "settings.preferences.westernNumerals.description", // shows both digit sets as samples
  "settings.acknowledgements.", // licence identifiers such as CC BY 4.0
];

const hasLiteralDigits = (key: string | string[]) =>
  (Array.isArray(key) ? key : [key]).some(
    (candidate) =>
      typeof candidate === "string" &&
      LITERAL_DIGIT_KEYS.some((prefix) => candidate.startsWith(prefix))
  );

// Carries the numeral preference into translated copy that holds its digits inline.
// The call-site formatter only reaches values the screen builds itself.
export const numeralPostProcessor: PostProcessorModule = {
  type: "postProcessor",
  name: "numerals",
  process: (value, key, options, translator) => {
    if (typeof value !== "string" || hasLiteralDigits(key)) return value;
    const locale = options?.lng ?? translator?.language ?? "";
    return localizeDigits(value, locale, usePreferencesStore.getState().useWesternNumerals);
  },
};
