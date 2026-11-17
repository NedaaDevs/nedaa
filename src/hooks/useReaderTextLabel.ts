import { useTranslation } from "react-i18next";

import type { AthkarReader } from "@/hooks/useAthkarReader";
import { useAthkarStore } from "@/stores/athkar";
import { splitAthkarText } from "@/utils/athkarText";

/** The reader's text aloud: the Arabic, a shown translation, the count. */
export const useReaderTextLabel = (reader: AthkarReader | null): string => {
  const { t, i18n } = useTranslation();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);
  if (!reader) return "";
  const { arabic, translation } = splitAthkarText(t(reader.current.textKey), i18n.language);
  return [arabic, ...(showTranslation && translation ? [translation] : []), reader.counted].reduce(
    (first, second) => t("a11y.join", { first, second })
  );
};
