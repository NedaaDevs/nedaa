import { act, fireEvent, screen } from "@testing-library/react-native";
import { Sun } from "lucide-react-native";

import config from "../../../../tamagui.config";
import { TIMELINE, TIMELINE_PART, Timeline, type TimelineMark } from "@/components/ui/timeline";
import { renderWithTheme } from "@/test-helpers/theme";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const LIGHT = config.themes.light;

const MARKS: TimelineMark[] = [
  { id: "a", share: 0, icon: Sun, label: "First" },
  { id: "b", share: 0.5, icon: Sun, label: "Middle" },
  { id: "c", share: 1, icon: Sun, label: "Last" },
];
const PROGRESS = { from: 0.5, to: 1, fraction: 0.25 };

const part = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });
const style = (id: string) =>
  Object.assign({}, ...[part(id)[0].props.style].flat(Infinity)) as Record<string, unknown>;

describe("Timeline", () => {
  beforeEach(() => {
    mockReduced = false;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("puts an icon and a name on the line for every mark, out of the reader's way", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={PROGRESS} accent="b" />);

    expect(part(TIMELINE_PART.MARK)).toHaveLength(MARKS.length);
    expect(screen.queryByText("Middle")).toBeNull();
    expect(screen.getByText("Middle", { includeHiddenElements: true })).toHaveStyle({
      color: LIGHT.accent.val,
    });
  });

  // Only the mark the caller names is drawn in the accent.
  it("draws only the accent mark in the accent", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={PROGRESS} accent="c" />);

    expect(screen.getByText("Last", { includeHiddenElements: true })).toHaveStyle({
      color: LIGHT.accent.val,
    });
    expect(screen.getByText("Middle", { includeHiddenElements: true })).not.toHaveStyle({
      color: LIGHT.accent.val,
    });
  });

  it("fills the current stretch by the time gone", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={PROGRESS} />);
    await act(() => jest.advanceTimersByTime(TIMELINE.fillMs + 50));

    const track = style(TIMELINE_PART.TRACK).width as number;
    expect(style(TIMELINE_PART.FILL).width).toBeCloseTo(track * PROGRESS.fraction);
  });

  it("leaves the line matte when nothing is under way", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={null} />);

    expect(part(TIMELINE_PART.FILL)).toHaveLength(0);
  });

  it("runs a shimmer along the fill", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={PROGRESS} />);

    expect(part(TIMELINE_PART.SHIMMER)).toHaveLength(1);
  });

  // Reduce Motion: the fill takes its length at once and nothing sweeps.
  it("holds still under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Timeline marks={MARKS} progress={PROGRESS} />);

    const track = style(TIMELINE_PART.TRACK).width as number;
    expect(style(TIMELINE_PART.FILL).width).toBeCloseTo(track * PROGRESS.fraction);
    expect(part(TIMELINE_PART.SHIMMER)).toHaveLength(0);
  });
  /** Lays the timeline out at a width, as the screen would. */
  const layOut = (width: number) =>
    act(() =>
      fireEvent(part(TIMELINE_PART.ROOT)[0], "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 80 } },
      })
    );
  const pair = (gap: number): TimelineMark[] => [
    { ...MARKS[0], share: 0 },
    { ...MARKS[1], share: gap },
    { ...MARKS[2], share: 1 },
  ];

  /** Each name's centre, given the width it takes. */
  const nameCentres = (width: number) =>
    part(TIMELINE_PART.NAME).map((node) => {
      const flat = Object.assign({}, ...[node.props.style].flat(Infinity));
      return flat.start + width / 2;
    });

  // The icons keep the true times; only the names step apart, on one row.
  it("spreads crowded names apart on the same row", async () => {
    await renderWithTheme(<Timeline marks={pair(0.05)} progress={null} />);
    await layOut(390);
    for (const node of part(TIMELINE_PART.NAME)) {
      await act(() =>
        fireEvent(node, "layout", {
          nativeEvent: { layout: { x: 0, y: 0, width: 30, height: 18 } },
        })
      );
    }

    const [first, second] = nameCentres(30);
    expect(second - first).toBeGreaterThanOrEqual(30 + TIMELINE.nameSpace - 1e-9);
  });

  // Android measures a name a pixel off as it moves; that must not move it.
  it("holds names still through sub-point changes in their measured width", async () => {
    await renderWithTheme(<Timeline marks={pair(0.05)} progress={null} />);
    await layOut(390);
    const measure = async (width: number) => {
      for (const node of part(TIMELINE_PART.NAME)) {
        await act(() =>
          fireEvent(node, "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 18 } } })
        );
      }
    };

    await measure(42.26);
    const before = nameCentres(43);
    await measure(42.67);

    expect(nameCentres(43)).toEqual(before);
  });

  it("puts a name with room right under its mark", async () => {
    await renderWithTheme(<Timeline marks={MARKS} progress={null} />);
    await layOut(390);

    expect(nameCentres(TIMELINE.nameWidth)).toEqual([TIMELINE.edge, 195, 390 - TIMELINE.edge]);
  });

  // Two icons closer than an icon's width would overlap; the later one yields.
  it("draws a mark as a dot where its icon would hit the one before", async () => {
    await renderWithTheme(<Timeline marks={pair(0.05)} progress={null} />);
    await layOut(390);

    expect(part(TIMELINE_PART.DOT)).toHaveLength(1);
  });
});
