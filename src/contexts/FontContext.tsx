import React, { createContext, useContext, useEffect, useState } from "react";

// Enums
import { AppLocale } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";

export type FontWeight = "regular" | "medium" | "semibold" | "bold";

export const FONT_MAPPINGS = {
  [AppLocale.AR]: {
    regular: "Tajawal-Regular",
    medium: "Tajawal-Medium",
    semibold: "Tajawal-Medium", // Tajawal doesn't have semibold, use medium
    bold: "Tajawal-Bold",
  },
  [AppLocale.EN]: {
    regular: "Roboto-Regular",
    medium: "Roboto-Medium",
    semibold: "Roboto-SemiBold",
    bold: "Roboto-Bold",
  },
  [AppLocale.MS]: {
    regular: "Roboto-Regular",
    medium: "Roboto-Medium",
    semibold: "Roboto-SemiBold",
    bold: "Roboto-Bold",
  },
};

interface FontContextType {
  fontFamily: Record<FontWeight, string>;
  locale: AppLocale;
  getFontFamily: (weight: FontWeight) => string;
}

const FontContext = createContext<FontContextType>({
  fontFamily: FONT_MAPPINGS[AppLocale.EN],
  locale: AppLocale.EN,
  getFontFamily: () => "Roboto-Regular",
});

interface FontProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that manages font families based on locale
 */
export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  const { locale } = useAppStore();
  const [fontFamily, setFontFamily] = useState<Record<FontWeight, string>>(
    FONT_MAPPINGS[locale] || FONT_MAPPINGS[AppLocale.EN]
  );

  // Update font families when locale changes
  useEffect(() => {
    setFontFamily(FONT_MAPPINGS[locale] || FONT_MAPPINGS[AppLocale.EN]);
  }, [locale]);

  const getFontFamily = (weight: FontWeight): string => {
    return fontFamily[weight] || fontFamily.regular;
  };

  return (
    <FontContext.Provider
      value={{
        fontFamily,
        locale,
        getFontFamily,
      }}>
      {children}
    </FontContext.Provider>
  );
};

/**
 * Hook to access the current font family based on weight
 */
export const useFontFamily = (weight: FontWeight = "regular"): string => {
  const { getFontFamily } = useContext(FontContext);

  // Return the font family for the specified weight
  return getFontFamily(weight);
};

export default FontProvider;
