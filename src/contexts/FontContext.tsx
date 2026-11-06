import React, { createContext, use } from "react";

// Enums
import { AppLocale } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";

// Constants
import { DEFAULT_FACES, FONT_MAPPINGS, type FontWeight } from "@/constants/Fonts";

export type { FontWeight };

interface FontContextType {
  fontFamily: Record<FontWeight, string>;
  locale: AppLocale;
  getFontFamily: (weight: FontWeight) => string;
}

const FontContext = createContext<FontContextType>({
  fontFamily: FONT_MAPPINGS[AppLocale.EN],
  locale: AppLocale.EN,
  getFontFamily: () => DEFAULT_FACES.regular,
});

interface FontProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that manages font families based on locale
 */
export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  const { locale } = useAppStore();

  // Derived during render, so a locale switch swaps the font in the same commit.
  // Holding it in state costs a second render in which Arabic text is still laid
  // out in the Latin-only family.
  const fontFamily = FONT_MAPPINGS[locale] || FONT_MAPPINGS[AppLocale.EN];

  const getFontFamily = (weight: FontWeight): string => {
    return fontFamily[weight] || fontFamily.regular;
  };

  return (
    <FontContext
      value={{
        fontFamily,
        locale,
        getFontFamily,
      }}>
      {children}
    </FontContext>
  );
};

/**
 * Hook to access the current font family based on weight
 */
export const useFontFamily = (weight: FontWeight = "regular"): string => {
  const { getFontFamily } = use(FontContext);

  // Return the font family for the specified weight
  return getFontFamily(weight);
};

export default FontProvider;
