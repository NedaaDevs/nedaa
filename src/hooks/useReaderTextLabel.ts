import { useTranslation } from "react-i18next";

import type { AthkarReader } from "@/hooks/useAthkarReader";
import { useDhikrText } from "@/hooks/useDhikrText";

/** The reader's text aloud: the Arabic, a shown translation, the count. */
export const useReaderTextLabel = (reader: AthkarReader | null): string => {
  const { t } = useTranslation();
  const { words, showTranslation } = useDhikrText();
  if (!reader) return "";
  const { arabic, translation } = words(reader.current.text);
  return [arabic, ...(showTranslation && translation ? [translation] : []), reader.counted].reduce(
    (first, second) => t("a11y.join", { first, second })
  );
};
