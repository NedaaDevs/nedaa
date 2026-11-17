export const splitAthkarText = (
  text: string,
  locale: string
): { arabic: string; translation: string | null } => {
  if (locale === "ar") return { arabic: text, translation: null };

  const parts = text.split("\n");
  if (parts.length >= 2) {
    return {
      arabic: parts[parts.length - 1].trim(),
      translation: parts.slice(0, -1).join("\n").trim(),
    };
  }

  return { arabic: text, translation: null };
};

/** The one line that names a dhikr: its translation where translations show, else its Arabic. */
export const athkarLine = (text: string, locale: string, showTranslation: boolean): string => {
  const { arabic, translation } = splitAthkarText(text, locale);
  return showTranslation && translation ? translation.split("\n")[0] : arabic;
};
