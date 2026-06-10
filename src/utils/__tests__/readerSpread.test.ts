import {
  resolveReaderLayout,
  spreadOf,
  pagesOfSpread,
  anchorPage,
  TOTAL_SPREADS,
  LARGE_DEVICE_MIN_DP,
} from "@/utils/readerSpread";

describe("page <-> spread mapping (RTL: right=earlier/odd, left=later/even)", () => {
  it("pairs (1,2),(3,4)...; odd page anchors its spread", () => {
    expect(spreadOf(1)).toBe(1);
    expect(spreadOf(2)).toBe(1);
    expect(spreadOf(3)).toBe(2);
    expect(spreadOf(604)).toBe(302);
    expect(TOTAL_SPREADS).toBe(302);
  });
  it("pagesOfSpread returns [right/earlier, left/later]", () => {
    expect(pagesOfSpread(1)).toEqual([1, 2]);
    expect(pagesOfSpread(302)).toEqual([603, 604]);
  });
  it("anchorPage is the spread's right/earlier (odd) page", () => {
    expect(anchorPage(3)).toBe(3);
    expect(anchorPage(4)).toBe(3);
    expect(anchorPage(1)).toBe(1);
  });
});

describe("resolveReaderLayout device matrix", () => {
  const layout = (w: number, h: number, spreadEnabled = true) =>
    resolveReaderLayout({ width: w, height: h, spreadEnabled });
  it("phone stays 'phone' in both orientations", () => {
    expect(layout(390, 844).mode).toBe("phone");
    expect(layout(844, 390).mode).toBe("phone");
  });
  it("large portrait => single; large landscape => spread", () => {
    expect(layout(834, 1112).mode).toBe("single");
    expect(layout(1194, 834).mode).toBe("spread");
  });
  it("large landscape with spread disabled => single", () => {
    expect(layout(1194, 834, false).mode).toBe("single");
  });
  it("threshold is shortest-side >= LARGE_DEVICE_MIN_DP", () => {
    expect(LARGE_DEVICE_MIN_DP).toBe(600);
    expect(layout(599, 900).mode).toBe("phone");
    expect(layout(600, 900).mode).toBe("single");
  });
});
