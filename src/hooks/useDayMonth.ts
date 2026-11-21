import { format } from "date-fns";

import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { getDateLocale } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

/** Writes a date as its day and month, "1 December", in the app's language. */
export const useDayMonth = () => {
  const locale = useAppStore((state) => state.locale);
  const useWesternNumerals = usePreferencesStore((state) => state.useWesternNumerals);
  return (date: Date) =>
    localizeDigits(
      format(date, "d MMMM", { locale: getDateLocale(locale) }),
      locale,
      useWesternNumerals
    );
};
