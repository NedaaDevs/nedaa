// Constants
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Types
import type { AladhanSettings } from "@/types/providers/aladhan";

type Translate = (key: string) => string;

type Option = { id: number; nameKey: string };

export type AladhanSection = {
  key: string;
  titleKey: string;
  placeholderKey: string;
  items: { label: string; value: string }[];
  /** The current selection, or "" when the setting is unset. */
  value: string;
  /** The settings patch for a chosen option, or null when the id is not on offer. */
  apply: (rawValue: string) => Partial<AladhanSettings> | null;
};

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;

// Titles and placeholders live under the singular namespace, options under its plural.
const buildSection = (
  key: string,
  namespace: string,
  options: readonly Option[],
  // Method is nullable in the settings type, so null counts as unset alongside undefined.
  current: number | null | undefined,
  field: keyof AladhanSettings,
  t: Translate
): AladhanSection => ({
  key,
  titleKey: `providers.aladhan.${namespace}.title`,
  placeholderKey: `providers.aladhan.${namespace}.selectPlaceholder`,
  items: options.map((option) => ({
    label: t(`providers.aladhan.${namespace}s.${option.nameKey}`),
    value: option.id.toString(),
  })),
  value: current == null ? "" : current.toString(),
  apply: (rawValue) => {
    const id = parseInt(rawValue, 10);
    if (!options.some((option) => option.id === id)) return null;
    return { [field]: id } as Partial<AladhanSettings>;
  },
});

export const buildAladhanSections = (settings: AladhanSettings, t: Translate): AladhanSection[] => [
  buildSection("method", "method", ALADHAN.methods, settings.method, "method", t),
  buildSection("school", "school", ALADHAN.schools, settings.madhab, "madhab", t),
  buildSection(
    "midnightMode",
    "midnightMode",
    ALADHAN.midnightModes,
    settings.midnightMode,
    "midnightMode",
    t
  ),
];
