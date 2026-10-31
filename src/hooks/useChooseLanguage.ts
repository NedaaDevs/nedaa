import { useThemeTransition } from "@/components/ui/theme-transition/context";
import type { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

/**
 * Applies a language under the theme dissolve, so its words, fonts and
 * direction change as one picture. The city's name in it lands later.
 */
export const useChooseLanguage = () => {
  const setLocale = useAppStore((state) => state.setLocale);
  const updateAddressTranslation = useLocationStore((state) => state.updateAddressTranslation);
  const withThemeTransition = useThemeTransition();
  return async (next: AppLocale) => {
    // Read at tap time: a second tap can land before the screen redraws.
    if (next === useAppStore.getState().locale) return;
    await withThemeTransition(() => {
      setLocale(next);
      void updateAddressTranslation();
    });
  };
};
