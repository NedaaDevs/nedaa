/** Combining marks ride on the letter before them and take no width of their own. */
const MARK = /\p{M}/u;

export const PREVIEW_ELLIPSIS = "…";

/**
 * Fits a text into `limit` characters on one run, cut after the last whole word,
 * with an ellipsis. Marks do not count, and a letter never loses its marks.
 */
export const cutPreview = (text: string, limit: number): string => {
  const run = text.replace(/\s+/g, " ").trim();
  let count = 0;
  let end = 0;
  let lastSpace = -1;
  for (const char of run) {
    if (!MARK.test(char)) {
      if (count === limit) {
        const cut = char === " " ? end : lastSpace > 0 ? lastSpace : end;
        return run.slice(0, cut).trimEnd() + PREVIEW_ELLIPSIS;
      }
      count += 1;
      if (char === " ") lastSpace = end;
    }
    end += char.length;
  }
  return run;
};
