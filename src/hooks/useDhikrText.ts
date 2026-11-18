import { useTranslation } from "react-i18next";

import { useAthkarStore } from "@/stores/athkar";
import { athkarLine, resolveDhikrText, type DhikrText } from "@/utils/athkarText";

/** Reads a dhikr's words in the app's language: both parts, or the one line that names it. */
export const useDhikrText = () => {
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);
  return {
    showTranslation,
    words: (text: DhikrText) => resolveDhikrText(text, t, i18n.language),
    line: (text: DhikrText) => athkarLine(text, t, i18n.language, showTranslation),
  };
};
