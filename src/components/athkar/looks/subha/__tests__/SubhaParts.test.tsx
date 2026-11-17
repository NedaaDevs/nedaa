import { useEffect } from "react";
import { screen, within } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import { SUBHA_KNOTS_PART, SubhaKnots } from "@/components/athkar/looks/subha/SubhaKnots";
import { SUBHA_SLAB_PART, SubhaStack } from "@/components/athkar/looks/subha/SubhaSlab";
import { SUBHA_STRING_PART, SubhaString } from "@/components/athkar/looks/subha/SubhaString";
import { SUBHA_TENS_PART, SubhaTens } from "@/components/athkar/looks/subha/SubhaTens";
import { materialTintId } from "@/components/ui/material";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import { SUBHA_BEADS, SUBHA_SLAB, SUBHA_STRING, SUBHA_STRING_KIND } from "@/constants/AthkarSubha";
import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { renderWithTheme } from "@/test-helpers/theme";
import type { PositionMark } from "@/utils/athkarSession";
import { beadPoint } from "@/utils/subhaBeads";

let mockReduceTransparency = false;

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/hooks/useReduceTransparency", () => ({
  useReduceTransparency: () => mockReduceTransparency,
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const hidden = { includeHiddenElements: true };
const READER = SUBHA_STRING[SUBHA_STRING_KIND.READER];
const LONG = 33;
const SHORT = 3;

const flat = (node: { props: { style?: unknown } }) =>
  Object.assign({}, ...[node.props.style].flat(Infinity));
const beads = () => screen.getAllByTestId(SUBHA_STRING_PART.BEAD, hidden).map(flat);
const xOf = (bead: { transform: { translateX?: number }[] }) => bead.transform[0].translateX;

const renderString = (count: number, target: number, reduceMotion = false) =>
  renderWithTheme(
    <SubhaString
      kind={SUBHA_STRING_KIND.READER}
      count={count}
      target={target}
      reduceMotion={reduceMotion}
    />
  );

beforeAll(() => useAppStore.setState({ locale: AppLocale.EN }));
beforeEach(() => {
  mockReduceTransparency = false;
  jest.mocked(withTiming).mockClear();
});

describe("SubhaString", () => {
  it("strings one bead per repeat, up to a round", async () => {
    const view = await renderString(0, SHORT);
    expect(beads()).toHaveLength(SHORT);
    await view.unmount();
    await renderString(0, LONG);
    expect(beads()).toHaveLength(SUBHA_BEADS.ROUND);
  });

  it("lights the counted beads and leaves the rest waiting", async () => {
    await renderString(1, SHORT);
    expect(beads().map(({ opacity }) => opacity)).toEqual([
      1,
      SUBHA_BEADS.WAITING_OPACITY,
      SUBHA_BEADS.WAITING_OPACITY,
    ]);
  });

  it("crosses a counted bead to the far end, from the left in English", async () => {
    await renderString(1, SHORT);
    expect(xOf(beads()[0])).toBe(beadPoint(0, 1, SHORT, READER, false).x);
    expect(xOf(beads()[2])).toBe(0);
  });

  it("slides a bead back when a repeat is taken back", async () => {
    const view = await renderString(2, SHORT);
    const across = xOf(beads()[1]);
    await view.rerender(
      <SubhaString kind={SUBHA_STRING_KIND.READER} count={1} target={SHORT} reduceMotion={false} />
    );
    expect(xOf(beads()[1])).not.toBe(across);
    expect(xOf(beads()[1])).toBe(beadPoint(1, 1, SHORT, READER, false).x);
    expect(withTiming).toHaveBeenCalled();
  });

  it("returns every bead to the start after a round of a long count", async () => {
    const view = await renderString(SUBHA_BEADS.ROUND - 1, LONG);
    await view.rerender(
      <SubhaString
        kind={SUBHA_STRING_KIND.READER}
        count={SUBHA_BEADS.ROUND}
        target={LONG}
        reduceMotion={false}
      />
    );
    expect(beads().every(({ opacity }) => opacity === SUBHA_BEADS.WAITING_OPACITY)).toBe(true);
  });

  it("undoes a round's end by sliding back only its last bead", async () => {
    for (const end of [SUBHA_BEADS.ROUND, 2 * SUBHA_BEADS.ROUND]) {
      const view = await renderString(end, LONG);
      jest.mocked(withTiming).mockClear();
      await view.rerender(
        <SubhaString
          kind={SUBHA_STRING_KIND.READER}
          count={end - 1}
          target={LONG}
          reduceMotion={false}
        />
      );
      // Every bead jumps to a full round first; then one slides back.
      const full = [...Array(SUBHA_BEADS.ROUND).keys()].map(
        (i) => beadPoint(i, SUBHA_BEADS.ROUND, SUBHA_BEADS.ROUND, READER, false).x
      );
      const jumps = jest
        .mocked(withTiming)
        .mock.calls.filter(([, config]) => config?.duration === 0)
        .map(([value]) => value);
      expect(jumps).toEqual(expect.arrayContaining(full));
      const ends = beads().map(xOf);
      expect(ends.filter((x, i) => x !== full[i])).toHaveLength(1);
      await view.unmount();
    }
  });

  it("moves no bead without motion: each one is set in place", async () => {
    const view = await renderString(1, SHORT, true);
    await view.rerender(
      <SubhaString kind={SUBHA_STRING_KIND.READER} count={2} target={SHORT} reduceMotion />
    );
    expect(xOf(beads()[1])).toBe(beadPoint(1, 2, SHORT, READER, false).x);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("draws its beads left to right and hides from a screen reader", async () => {
    await renderString(0, SHORT);
    const string = screen.getByTestId(SUBHA_STRING_PART.STRING, hidden);
    expect(string).toHaveStyle({ direction: "ltr" });
    expect(screen.queryByTestId(SUBHA_STRING_PART.STRING)).toBeNull();
  });
});

describe("SubhaTens", () => {
  it("draws a dot per round of a long count, lit as each passes", async () => {
    await renderWithTheme(<SubhaTens count={12} target={LONG} reduceMotion={false} />);
    expect(screen.getAllByTestId(SUBHA_TENS_PART.LIT, hidden)).toHaveLength(1);
    expect(screen.getAllByTestId(SUBHA_TENS_PART.DOT, hidden)).toHaveLength(2);
  });

  it("draws nothing for a count of a round or less", async () => {
    await renderWithTheme(<SubhaTens count={1} target={SHORT} reduceMotion={false} />);
    expect(screen.queryByTestId(SUBHA_TENS_PART.DOT, hidden)).toBeNull();
  });
});

const mark = (id: string, state: PositionMark["state"]): PositionMark => ({
  id,
  state,
  size: MARK_SIZE.FULL,
});

describe("SubhaKnots", () => {
  it("ties a knot per dhikr and a bead on the current one", async () => {
    const marks = [
      mark("a", MARK_STATE.DONE),
      mark("b", MARK_STATE.CURRENT),
      mark("c", MARK_STATE.REMAINING),
    ];
    await renderWithTheme(<SubhaKnots marks={marks} />);
    expect(screen.getAllByTestId(SUBHA_KNOTS_PART.KNOT, hidden)).toHaveLength(2);
    expect(screen.getByTestId(SUBHA_KNOTS_PART.CURRENT, hidden)).toBeOnTheScreen();
  });
});

describe("SubhaStack", () => {
  const renderStack = (waiting: number) =>
    renderWithTheme(
      <SubhaStack itemId="a" waiting={waiting} reduceMotion={false}>
        <></>
      </SubhaStack>
    );

  it("stacks up to two slabs behind for the dhikr still to come", async () => {
    const view = await renderStack(0);
    expect(screen.queryAllByTestId(SUBHA_SLAB_PART.BEHIND, hidden)).toHaveLength(0);
    await view.unmount();
    await renderStack(5);
    expect(screen.getAllByTestId(SUBHA_SLAB_PART.BEHIND, hidden)).toHaveLength(
      SUBHA_SLAB.BEHIND.length
    );
  });

  it("keeps what it holds mounted when the dhikr changes", async () => {
    const mounts = jest.fn();
    const Held = () => {
      useEffect(mounts, []);
      return null;
    };
    const stack = (itemId: string) => (
      <SubhaStack itemId={itemId} waiting={2} reduceMotion={false}>
        <Held />
      </SubhaStack>
    );
    const view = await renderWithTheme(stack("a"));
    await view.rerender(stack("b"));
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it("paints the slabs behind as tint alone, with no blur to fade", async () => {
    await renderStack(5);
    for (const slab of screen.getAllByTestId(SUBHA_SLAB_PART.BEHIND, hidden)) {
      expect(flat(slab).opacity ?? 1).toBe(1);
      expect(within(slab).queryAllByTestId(materialTintId(), hidden)).toHaveLength(0);
    }
  });

  it("draws one solid slab when transparency is reduced", async () => {
    mockReduceTransparency = true;
    await renderStack(5);
    expect(screen.queryAllByTestId(SUBHA_SLAB_PART.BEHIND, hidden)).toHaveLength(0);
    const tint = screen.getByTestId(materialTintId(), hidden);
    expect(flat(tint).backgroundColor).toMatch(/FF$/);
  });
});
