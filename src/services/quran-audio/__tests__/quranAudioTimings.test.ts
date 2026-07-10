import { _parseTimings } from "@/services/quran-audio/quranAudioTimings";

describe("quranAudioTimings parse", () => {
  it("accepts the stripped array shape", () => {
    const map = _parseTimings({
      "1:1": [
        [1, 0, 840],
        [2, 1040, 1440],
      ],
    });
    expect(map["1:1"]).toEqual([
      [1, 0, 840],
      [2, 1040, 1440],
    ]);
  });

  it("accepts the raw QUL { segments } shape", () => {
    const map = _parseTimings({ "1:1": { segments: [[1, 0, 840]] } });
    expect(map["1:1"]).toEqual([[1, 0, 840]]);
  });

  it("drops malformed segments and skips ayahs left with none", () => {
    const map = _parseTimings({
      "1:1": [[1, 0, 840], ["x", 1, 2], [3]],
    });
    expect(map["1:1"]).toEqual([[1, 0, 840]]);
    expect(map["2:1"]).toBeUndefined();
  });

  // Regression: a few ayahs carry a backward index reset upstream
  // (…11,12,13,11,12,13,14…). The reset segments must be dropped so the
  // highlight can't jump back mid-ayah; indices must stay strictly increasing.
  it("drops backward-reset duplicates, keeping strictly-increasing indices", () => {
    const map = _parseTimings({
      "2:237": [
        [1, 0, 100],
        [2, 100, 200],
        [3, 200, 300],
        [1, 300, 400], // reset — dropped
        [2, 400, 500], // reset — dropped
        [3, 500, 600], // reset — dropped
        [4, 600, 700],
      ],
    });
    expect(map["2:237"].map((s) => s[0])).toEqual([1, 2, 3, 4]);
    // the kept segments retain their original (earlier) timings
    expect(map["2:237"]).toEqual([
      [1, 0, 100],
      [2, 100, 200],
      [3, 200, 300],
      [4, 600, 700],
    ]);
  });

  // Regression (2:58-class): the aligner leaves ~16% of ayahs with a degenerate
  // final segment — a <200ms sliver at EOF after a gap — so the last word never
  // visibly lights. The repair pulls its start back to the previous segment's end.
  it("repairs a degenerate final segment by closing the gap before it", () => {
    const map = _parseTimings({
      "2:58": [
        [19, 20200, 21480],
        [20, 23890, 23930], // 40ms sliver after a 2.4s gap
      ],
    });
    expect(map["2:58"]).toEqual([
      [19, 20200, 21480],
      [20, 21480, 23930], // start pulled back to w19's end
    ]);
  });

  it("leaves a healthy final segment untouched", () => {
    const map = _parseTimings({
      "1:1": [
        [1, 0, 840],
        [2, 1040, 1440], // 400ms — normal word, small inter-word gap
      ],
    });
    expect(map["1:1"]).toEqual([
      [1, 0, 840],
      [2, 1040, 1440],
    ]);
  });
});
