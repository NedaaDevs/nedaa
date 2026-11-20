import { PREVIEW_ELLIPSIS, cutPreview } from "@/utils/previewText";

/** Combining marks: Arabic harakat and shadda, and Latin accents. */
const MARK = /\p{M}/u;
const letters = (text: string) => [...text].filter((char) => !MARK.test(char)).length;

const KURSI =
  "﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ";

describe("cutPreview", () => {
  it("leaves a text that fits as it is", () => {
    expect(cutPreview("سُبْحَانَ اللَّهِ", 20)).toBe("سُبْحَانَ اللَّهِ");
  });

  it("counts letters, not the marks on them", () => {
    // Ten characters with the space, but nearly twice as many code points.
    expect(cutPreview("سُبْحَانَ اللَّهِ", 10)).toBe("سُبْحَانَ اللَّهِ");
  });

  it("cuts at the last word that fits and ends in an ellipsis", () => {
    const cut = cutPreview(KURSI, 30);

    expect(cut.endsWith(PREVIEW_ELLIPSIS)).toBe(true);
    const kept = cut.slice(0, -PREVIEW_ELLIPSIS.length);
    expect(KURSI.startsWith(kept)).toBe(true);
    expect(KURSI[kept.length]).toBe(" ");
    expect(letters(kept)).toBeLessThanOrEqual(30);
  });

  it("joins lines into one run before it cuts", () => {
    expect(cutPreview("الحمد لله\nرب العالمين", 40)).toBe("الحمد لله رب العالمين");
  });

  it("keeps a letter's marks with it when one word runs past the budget", () => {
    const word = "الْقَيُّومُ";
    const cut = cutPreview(word, 4);
    const kept = cut.slice(0, -PREVIEW_ELLIPSIS.length);

    expect(word.startsWith(kept)).toBe(true);
    expect(MARK.test(word[kept.length])).toBe(false);
    expect(letters(kept)).toBe(4);
  });

  it("never splits a surrogate pair", () => {
    const cut = cutPreview("ab😀cd", 3);

    expect(cut).toBe(`ab😀${PREVIEW_ELLIPSIS}`);
  });
});
