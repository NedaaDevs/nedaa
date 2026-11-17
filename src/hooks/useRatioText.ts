import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { countText, LTR_ISOLATE } from "@/utils/digits";

/** Writes a whole count in the reader's digits. */
export const useCountText = () => {
  const locale = useAppStore((s) => s.locale);
  const western = usePreferencesStore((s) => s.useWesternNumerals);
  return (count: number) => countText(count, locale, western);
};

/** Writes "count / total" in the reader's digits, isolated so the paragraph around it cannot split it. */
export const useRatioText = () => {
  const text = useCountText();
  return (count: number, total: number) =>
    `${LTR_ISOLATE.OPEN}${text(count)} / ${text(total)}${LTR_ISOLATE.CLOSE}`;
};
