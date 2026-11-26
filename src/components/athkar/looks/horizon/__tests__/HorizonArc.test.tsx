import { screen } from "@testing-library/react-native";

import { HORIZON_ARC_PART, HorizonArc } from "@/components/athkar/looks/horizon/HorizonArc";
import { HORIZON_ARC, HORIZON_ARC_KIND } from "@/constants/AthkarHorizon";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import { renderWithTheme } from "@/test-helpers/theme";
import type { PositionMark } from "@/utils/athkarSession";

let mockRTL = true;

jest.mock("@/contexts/RTLContext", () => ({
  ...jest.requireActual("@/contexts/RTLContext"),
  useRTL: () => ({ isRTL: mockRTL }),
}));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const hidden = { includeHiddenElements: true };

/** Marks with the place at `at`; `fine` makes the last ones fine. */
const marks = (total: number, at: number | null, fine = 0): PositionMark[] =>
  Array.from({ length: total }, (_, i) => ({
    id: `${i}`,
    state:
      at === null || i < at
        ? MARK_STATE.DONE
        : i === at
          ? MARK_STATE.CURRENT
          : MARK_STATE.REMAINING,
    size: i >= total - fine ? MARK_SIZE.FINE : MARK_SIZE.FULL,
  }));

const sunX = () => {
  const { style } = screen.getByTestId(HORIZON_ARC_PART.SUN, hidden).props;
  const flat = Object.assign({}, ...[style].flat(Infinity));
  return flat.transform[0].translateX as number;
};

const draw = (list: PositionMark[], fraction = 0) =>
  renderWithTheme(<HorizonArc kind={HORIZON_ARC_KIND.READER} marks={list} fraction={fraction} />);

describe("HorizonArc", () => {
  beforeEach(() => {
    mockRTL = true;
  });

  it("draws a point for every dhikr but the current one, which the sun marks", async () => {
    await draw(marks(5, 2));
    expect(screen.getAllByTestId(HORIZON_ARC_PART.POINT, hidden)).toHaveLength(4);
    expect(screen.getAllByTestId(HORIZON_ARC_PART.SUN, hidden)).toHaveLength(1);
  });

  it("draws fine points smaller than full ones", async () => {
    const FINE = 3;
    await draw(marks(8, 1, FINE));
    // Points keep the marks' order; the last ones are the fine marks.
    const radii = screen
      .getAllByTestId(HORIZON_ARC_PART.POINT, hidden)
      .map(({ props }) => Number(props.r));
    const full = radii.slice(0, -FINE);
    const fine = radii.slice(-FINE);
    expect(Math.max(...fine)).toBeLessThan(Math.min(...full));
  });

  it("starts the session at the right in Arabic and at the left in English", async () => {
    const { unmount } = await draw(marks(5, 0));
    const arabic = sunX();
    await unmount();
    mockRTL = false;
    await draw(marks(5, 0));
    const english = sunX();
    const { WIDTH } = HORIZON_ARC[HORIZON_ARC_KIND.READER];
    expect(arabic).toBeGreaterThan(WIDTH / 2);
    expect(english).toBeLessThan(WIDTH / 2);
    expect(arabic + english).toBeCloseTo(WIDTH - HORIZON_ARC[HORIZON_ARC_KIND.READER].SUN, 0);
  });

  it("lights more of the line as the count fills", async () => {
    const lit = () =>
      Number(screen.getByTestId(HORIZON_ARC_PART.LIT, hidden).props.strokeDashoffset);
    const { unmount } = await draw(marks(5, 2), 0);
    const empty = lit();
    await unmount();
    await draw(marks(5, 2), 1);
    expect(lit()).toBeLessThan(empty);
  });

  it("is hidden from a screen reader: its owner names the place", async () => {
    await draw(marks(5, 2));
    expect(screen.queryByTestId(HORIZON_ARC_PART.SUN)).toBeNull();
  });
});
