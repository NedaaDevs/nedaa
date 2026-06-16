import { convertQulPhrases, type QulPhrases } from "../convert";

describe("convertQulPhrases", () => {
  it("keeps distinctive phrases and exposes per-verse spans", () => {
    const phrases: QulPhrases = {
      "1": { source: { key: "2:1", from: 1, to: 4 }, ayah: { "2:1": [[1, 4]], "3:1": [[1, 4]] } },
    };
    const groups = convertQulPhrases(phrases);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("2:1,3:1");
    expect(groups[0].members).toEqual([
      { key: "2:1", spans: [[1, 4]] },
      { key: "3:1", spans: [[1, 4]] },
    ]);
  });

  it("drops short common collocations (3-word phrase shared by many verses)", () => {
    const ayah: Record<string, [number, number][]> = {};
    for (let s = 1; s <= 8; s++) ayah[`${s}:1`] = [[1, 3]];
    const phrases: QulPhrases = { "1": { source: { key: "1:1", from: 1, to: 3 }, ayah } };
    expect(convertQulPhrases(phrases)).toEqual([]);
  });

  it("merges phrases over the same verse set, unioning their spans", () => {
    const phrases: QulPhrases = {
      "1": { source: { key: "17:41", from: 1, to: 5 }, ayah: { "17:41": [[1, 5]], "18:54": [[1, 5]] } },
      "2": { source: { key: "17:41", from: 7, to: 9 }, ayah: { "17:41": [[7, 9]], "18:54": [[6, 8]] } },
    };
    const groups = convertQulPhrases(phrases);
    expect(groups).toHaveLength(1);
    const m41 = groups[0].members.find((m) => m.key === "17:41")!;
    expect(m41.spans).toEqual([[1, 5], [7, 9]]);
  });
});
