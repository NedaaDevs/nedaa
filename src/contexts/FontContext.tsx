import React, { createContext, use } from "react";

// Enums
import { AppLocale } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";

export type FontWeight = "regular" | "medium" | "semibold" | "bold";

export const FONT_MAPPINGS = {
  [AppLocale.AR]: {
    regular: "IBMPlexSans-Regular",
    medium: "IBMPlexSans-Medium",
    semibold: "IBMPlexSans-SemiBold",
    bold: "IBMPlexSans-Bold",
  },
  [AppLocale.EN]: {
    regular: "Asap-Regular",
    medium: "Asap-Medium",
    semibold: "Asap-SemiBold",
    bold: "Asap-Bold",
  },
  [AppLocale.MS]: {
    regular: "Asap-Regular",
    medium: "Asap-Medium",
    semibold: "Asap-SemiBold",
    bold: "Asap-Bold",
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
  getFontFamily: () => "Asap-Regular",
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
