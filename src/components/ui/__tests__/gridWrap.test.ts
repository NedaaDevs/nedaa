import type { DimensionValue, ViewStyle } from "react-native";
import { Direction, Edge, FlexDirection, Gutter, Wrap, loadYoga } from "yoga-layout/load";

import { gridCellStyle } from "@/components/ui/grid";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

type Yoga = Awaited<ReturnType<typeof loadYoga>>;
type YogaNode = ReturnType<Yoga["Node"]["create"]>;

const GAP = 8;
const SHARE = "48%";
const SCREENS_PX = [1080, 1440];
const DENSITIES = [2.625, 2.75, 3, 3.5, 404 / 160, 441 / 160];
const INSETS = [16, 27];

const CASES = SCREENS_PX.flatMap((px) =>
  DENSITIES.flatMap((density) => INSETS.map((inset) => ({ px, density, inset })))
);

let yoga: Yoga;
beforeAll(async () => {
  yoga = await loadYoga();
});

const isPercent = (value: string): value is `${number}%` => value.endsWith("%");

const size = (value: DimensionValue | undefined) =>
  typeof value === "number" || (typeof value === "string" && isPercent(value)) ? value : undefined;

const applyStyle = (node: YogaNode, style: ViewStyle) => {
  if (style.width !== undefined) node.setWidth(size(style.width));
  if (style.flexBasis !== undefined) node.setFlexBasis(size(style.flexBasis));
  if (style.flexGrow !== undefined) node.setFlexGrow(style.flexGrow);
  if (style.maxWidth !== undefined) node.setMaxWidth(size(style.maxWidth));
};

/** One screen: an inset wrapper around a wrapping row of cells. */
const layOut = (
  { px, density, inset }: (typeof CASES)[number],
  cells: ViewStyle[]
): { width: number; cells: { top: number; width: number }[] } => {
  const config = yoga.Config.create();
  config.setPointScaleFactor(density);
  const root = yoga.Node.create(config);
  root.setWidth(px / density);
  root.setPadding(Edge.Horizontal, inset);
  const grid = yoga.Node.create(config);
  grid.setFlexDirection(FlexDirection.Row);
  grid.setFlexWrap(Wrap.Wrap);
  grid.setGap(Gutter.Column, GAP);
  grid.setGap(Gutter.Row, GAP);
  root.insertChild(grid, 0);
  const nodes = cells.map((style, index) => {
    const node = yoga.Node.create(config);
    node.setHeight(50);
    applyStyle(node, style);
    grid.insertChild(node, index);
    return node;
  });
  root.calculateLayout(undefined, undefined, Direction.RTL);
  const result = {
    width: grid.getComputedLayout().width,
    cells: nodes.map((node) => node.getComputedLayout()),
  };
  root.freeRecursive();
  config.free();
  return result;
};

/** Lays out `count` cells after one measuring pass, as the grid does. */
const measured = (screen: (typeof CASES)[number], count: number, wide?: number) => {
  const hairline = 1 / screen.density;
  const premeasure = gridCellStyle({ share: SHARE, hairline });
  const full = layOut(screen, [premeasure, premeasure]).width;
  const column = (full - GAP) / 2;
  const styles = Array.from({ length: count }, (_, index) =>
    gridCellStyle({ column, full, share: SHARE, hairline, wide: index === wide })
  );
  return { column, full, cells: layOut(screen, styles).cells };
};

const label = ({ px, density, inset }: (typeof CASES)[number]) =>
  `${px}px @${density.toFixed(3)} inset ${inset}`;

// Android hands onLayout a pixel-rounded width, and Yoga wraps on a strict `>`
// over unrounded floats, so a cell rule that fills the row exactly can wrap.
describe("grid cells under the real layout engine", () => {
  it.each(CASES.map((screen) => [label(screen), screen] as const))(
    "keeps two cells on one row at %s",
    (_, screen) => {
      const [first, second] = measured(screen, 2).cells;
      expect(second.top).toBe(first.top);
    }
  );

  it.each(CASES.map((screen) => [label(screen), screen] as const))(
    "keeps a lone last cell one column wide at %s",
    (_, screen) => {
      const { column, cells } = measured(screen, 3);
      expect(cells[2].width).toBeLessThanOrEqual(column + 1 / screen.density);
      expect(cells[2].top).toBeGreaterThan(cells[0].top);
    }
  );

  it("gives a wide cell the whole row", () => {
    const { full, cells } = measured(CASES[0], 3, 0);
    expect(cells[0].width).toBeCloseTo(full, 1);
    expect(cells[2].top).toBe(cells[1].top);
  });
});
