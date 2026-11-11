import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import type {
  AladhanMethod,
  AladhanMethodId,
  AladhanPrayerTimeName,
  AladhanSettings,
  AladhanTuning,
} from "@/types/providers/aladhan";
import { LTR_ISOLATE } from "@/utils/digits";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;

// Harakat, the dagger alef and tatweel, which a typed query rarely carries.
const MARKS = /[\u064B-\u065F\u0670\u0640]/g;
// Directional isolates around Latin names such as «⁦ISNA⁩».
const ISOLATES = new RegExp(`[${LTR_ISOLATE.OPEN}-${LTR_ISOLATE.CLOSE}]`, "g");
const ALEF_FORMS = /[\u0622\u0623\u0625\u0671]/g;

const normalize = (text: string) =>
  text
    .replace(MARKS, "")
    .replace(ISOLATES, "")
    .replace(ALEF_FORMS, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();

/** Whether a shown name holds the query, compared as a reader types it. */
export const matchesQuery = (name: string, query: string) =>
  normalize(name).includes(normalize(query));

/** The methods whose shown name holds the query, in their listed order. */
export const methodsMatching = (
  query: string,
  nameOf: (method: AladhanMethod) => string
): AladhanMethod[] => ALADHAN.methods.filter((method) => matchesQuery(nameOf(method), query));

/** Minutes the draft moves a timing past the times already fetched. */
export const tuneShift = (
  draft: AladhanTuning | undefined,
  applied: AladhanTuning | undefined,
  timing: AladhanPrayerTimeName
) => (draft?.[timing] ?? 0) - (applied?.[timing] ?? 0);

/** Whether the draft needs the server: no local preview can show it. */
export const recalculates = (draft: AladhanSettings, applied: AladhanSettings | undefined) =>
  (draft.method ?? null) !== (applied?.method ?? null) ||
  draft.madhab !== applied?.madhab ||
  draft.midnightMode !== applied?.midnightMode;

/** A choice of the sheet: its id, its short name and what it means. */
export type CalculationOption<Id extends number> = {
  id: Id;
  nameKey: string;
  descriptionKey: string;
};

const optionsOf = <Id extends number>(
  namespace: string,
  source: readonly { id: Id; nameKey: string }[]
): CalculationOption<Id>[] =>
  source.map(({ id, nameKey }) => ({
    id,
    nameKey: `settings.calculation.${namespace}.options.${nameKey}.name`,
    descriptionKey: `settings.calculation.${namespace}.options.${nameKey}.description`,
  }));

export const ASR_OPTIONS = optionsOf("asr", ALADHAN.schools);
export const MIDNIGHT_OPTIONS = optionsOf("midnight", ALADHAN.midnightModes);

/** The chosen option's short-name key; undefined while none is set. */
export const optionNameKey = <Id extends number>(
  options: readonly CalculationOption<Id>[],
  id: number | undefined
) => options.find((option) => option.id === id)?.nameKey;

/** A chosen method's name key; null while the provider picks one. */
export const methodNameKey = (id: AladhanMethodId | undefined) => {
  const method = ALADHAN.methods.find((candidate) => candidate.id === id);
  return method ? `providers.aladhan.methods.${method.nameKey}` : null;
};

/** The method in effect by name, or the provider's choice when none is set. */
export const methodName = (id: AladhanMethodId | undefined, t: (key: string) => string) => {
  const key = methodNameKey(id);
  return key ? t(key) : t("settings.summary.methodAuto");
};

/**
 * The method behind a choice: the chosen one, else the one the provider reported,
 * while the stored times also came from the provider's choice.
 */
export const resolvedMethod = (
  chosen: AladhanMethodId | undefined,
  applied: AladhanMethodId | undefined,
  reported: AladhanMethodId | undefined
) => chosen ?? (applied == null ? (reported ?? undefined) : undefined);
