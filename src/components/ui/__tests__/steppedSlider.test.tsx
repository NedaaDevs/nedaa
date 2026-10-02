import "react-native-gesture-handler/jestSetup";
import { useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { withTiming } from "react-native-reanimated";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import {
  STEPPED_SLIDER_GESTURE,
  STEPPED_SLIDER_PART,
  SteppedSlider,
  stopIndexAt,
  stopOffset,
} from "@/components/ui/stepped-slider";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { PlatformType } from "@/enums/app";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const mockHaptic = jest.fn();
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => mockHaptic }));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const STOPS = ["xs", "s", "m", "l"] as const;
type Stop = (typeof STOPS)[number];
const LABEL = "Text size";
const NAMES: Record<Stop, string> = { xs: "Tiny", s: "Small", m: "Medium", l: "Large" };

// A 324pt track with a 24pt thumb leaves 300pt between the first and last stop.
const WIDTH = 324;
const AT = [12, 112, 212, 312] as const;

const onChange = jest.fn();
const onDraft = jest.fn();

const Harness = ({ start, isRTL = false }: { start: Stop; isRTL?: boolean }) => {
  const [value, setValue] = useState<Stop>(start);
  return (
    <ThemeProvider isRTL={isRTL}>
      <SteppedSlider
        stops={STOPS}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        onDraft={onDraft}
        formatValue={(stop) => NAMES[stop]}
        stopLabel={(stop) => NAMES[stop]}
        accessibilityLabel={LABEL}
        startMark={<Text testID="start-mark">a</Text>}
        endMark={<Text testID="end-mark">A</Text>}
      />
    </ThemeProvider>
  );
};

const hidden = { includeHiddenElements: true } as const;
const adjustable = () => screen.getByRole("adjustable", { name: LABEL });
const layOut = () =>
  act(() =>
    fireEvent(screen.getByTestId(STEPPED_SLIDER_PART.TRACK, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 44 } },
    })
  );

const show = async (start: Stop, isRTL = false) => {
  await render(<Harness start={start} isRTL={isRTL} />);
  await layOut();
};

const drag = (...xs: number[]) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN), [
      { state: State.BEGAN, x: xs[0], translationX: 0 },
      { state: State.ACTIVE, x: xs[0], translationX: 0 },
      ...xs.slice(1).map((x) => ({ x, translationX: x - xs[0] })),
      { state: State.END, x: xs[xs.length - 1], translationX: xs[xs.length - 1] - xs[0] },
    ])
  );

const tap = (x: number) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(STEPPED_SLIDER_GESTURE.TAP), [
      { state: State.BEGAN, x },
      { state: State.END, x },
    ])
  );

const thumbStart = () =>
  StyleSheet.flatten(screen.getByTestId(STEPPED_SLIDER_PART.THUMB, hidden).props.style).start;

describe("stop geometry", () => {
  it.each([
    [0, 0],
    [12, 0],
    [61, 0],
    [63, 1],
    [212, 2],
    [312, 3],
    [WIDTH + 40, 3],
    [-20, 0],
  ])("reads x=%p as stop %p from the left in LTR", (x, index) => {
    expect(stopIndexAt(x, WIDTH, STOPS.length, false)).toBe(index);
  });

  it.each([
    [312, 0],
    [212, 1],
    [112, 2],
    [12, 3],
  ])("mirrors x=%p to stop %p in RTL", (x, index) => {
    expect(stopIndexAt(x, WIDTH, STOPS.length, true)).toBe(index);
  });

  it("places each stop from the reading start, a thumb's half in from the edge", () => {
    expect(STOPS.map((_, index) => stopOffset(index, WIDTH, STOPS.length))).toEqual(AT);
  });
});

describe("SteppedSlider", () => {
  beforeEach(() => {
    onChange.mockClear();
    onDraft.mockClear();
    mockHaptic.mockClear();
    mockReduced = false;
    jest.mocked(withTiming).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  describe("drag", () => {
    it("drafts each stop it crosses and commits once on release", async () => {
      await show("xs");

      await drag(AT[0], AT[1], AT[2]);

      expect(onDraft.mock.calls).toEqual([["s"], ["m"]]);
      expect(mockHaptic).toHaveBeenCalledTimes(2);
      expect(onChange.mock.calls).toEqual([["m"]]);
    });

    it("drafts and ticks every stop a fast fling skips, in order", async () => {
      await show("xs");

      await drag(AT[0], AT[2]);

      expect(onDraft.mock.calls).toEqual([["s"], ["m"]]);
      expect(mockHaptic).toHaveBeenCalledTimes(2);
      expect(onChange.mock.calls).toEqual([["m"]]);
    });

    it("drafts each skipped stop on the way back down too", async () => {
      await show("l");

      await drag(AT[3], AT[0]);

      expect(onDraft.mock.calls).toEqual([["m"], ["s"], ["xs"]]);
      expect(mockHaptic).toHaveBeenCalledTimes(3);
    });

    it("mirrors the drag in RTL, so the first stop sits at the right", async () => {
      await show("xs", true);

      await drag(AT[3], AT[2], AT[1]);

      expect(onDraft.mock.calls).toEqual([["s"], ["m"]]);
      expect(onChange.mock.calls).toEqual([["m"]]);
    });

    it("commits nothing when the drag ends where it began", async () => {
      await show("s");

      await drag(AT[1], AT[2], AT[1]);

      expect(onDraft.mock.calls).toEqual([["m"], ["s"]]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("drafts the committed stop again when the drag is cancelled", async () => {
      await show("xs");

      await act(() =>
        fireGestureHandler(getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN), [
          { state: State.BEGAN, x: AT[0], translationX: 0 },
          { state: State.ACTIVE, x: AT[0], translationX: 0 },
          { x: AT[2], translationX: AT[2] - AT[0] },
          { state: State.CANCELLED, x: AT[2], translationX: AT[2] - AT[0] },
        ])
      );

      expect(onDraft).toHaveBeenLastCalledWith("xs");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("tap", () => {
    it("jumps to the tapped stop with one tick", async () => {
      await show("xs");

      await tap(AT[3]);

      expect(onChange.mock.calls).toEqual([["l"]]);
      expect(mockHaptic).toHaveBeenCalledTimes(1);
      expect(onDraft).not.toHaveBeenCalled();
    });

    it("ignores a tap on the chosen stop", async () => {
      await show("m");

      await tap(AT[2]);

      expect(onChange).not.toHaveBeenCalled();
      expect(mockHaptic).not.toHaveBeenCalled();
    });
  });

  describe("thumb", () => {
    it("sits on the chosen stop, measured from the reading start", async () => {
      await show("s");

      expect(thumbStart()).toBe(AT[1] - 12);
    });

    it("glides to a new stop", async () => {
      await show("xs");
      jest.mocked(withTiming).mockClear();

      await tap(AT[2]);

      expect(thumbStart()).toBe(AT[2] - 12);
      expect(withTiming).toHaveBeenCalled();
    });

    it("jumps without gliding under Reduce Motion", async () => {
      mockReduced = true;
      await show("xs");

      await tap(AT[2]);

      expect(thumbStart()).toBe(AT[2] - 12);
      expect(withTiming).not.toHaveBeenCalled();
    });
  });

  describe("fill", () => {
    const fill = () =>
      StyleSheet.flatten(screen.getByTestId(STEPPED_SLIDER_PART.FILL, hidden).props.style);

    it("runs from the first stop to the thumb", async () => {
      await show("m");

      expect(fill()).toMatchObject({ start: AT[0], width: AT[2] - AT[0] });
    });

    it("colours the stops it has passed and leaves the rest on the sky's muted tone", async () => {
      await show("s");

      const dots = screen.getAllByTestId(STEPPED_SLIDER_PART.DOT, hidden);
      expect(dots.map((dot) => StyleSheet.flatten(dot.props.style).backgroundColor)).toEqual([
        NEDAA_LIGHT.accent.hex,
        NEDAA_LIGHT.accent.hex,
        NEDAA_LIGHT.mutedSky.hex,
        NEDAA_LIGHT.mutedSky.hex,
      ]);
    });
  });

  describe("screen reader", () => {
    it("is one adjustable element that speaks the stop's name", async () => {
      await show("s");

      expect(adjustable()).toHaveAccessibilityValue({ min: 0, max: 3, now: 1, text: "Small" });
      expect(screen.queryByText("Tiny")).toBeNull();
      expect(screen.queryByTestId("start-mark")).toBeNull();
    });

    it.each([
      [A11Y_ACTION.INCREMENT, "m"],
      [A11Y_ACTION.DECREMENT, "xs"],
    ])("steps once on %s", async (actionName, expected) => {
      await show("s");

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", { nativeEvent: { actionName } })
      );

      expect(onChange.mock.calls).toEqual([[expected]]);
      expect(mockHaptic).toHaveBeenCalledTimes(1);
    });

    it.each([
      [A11Y_ACTION.INCREMENT, "l"],
      [A11Y_ACTION.DECREMENT, "xs"],
    ])("stops at the end on %s", async (actionName, start) => {
      await show(start as Stop);

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", { nativeEvent: { actionName } })
      );

      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores an action that is not a step", async () => {
      await show("s");

      await act(() =>
        fireEvent(adjustable(), "accessibilityAction", {
          nativeEvent: { actionName: A11Y_ACTION.ACTIVATE },
        })
      );

      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      [PlatformType.ANDROID, [{ name: A11Y_ACTION.INCREMENT }, { name: A11Y_ACTION.DECREMENT }]],
      [PlatformType.IOS, undefined],
    ])("lists its actions on %s as the reader needs", async (os, actions) => {
      jest.replaceProperty(Platform, "OS", os);
      await show("s");

      expect(adjustable().props.accessibilityActions).toEqual(actions);
    });
  });

  describe("labels", () => {
    it("draws each stop's label, the chosen one bolder and in the text colour", async () => {
      await show("m");

      const style = (name: string) =>
        StyleSheet.flatten(screen.getByText(name, hidden).props.style);
      expect(STOPS.map((stop) => style(NAMES[stop]).color)).toEqual([
        NEDAA_LIGHT.mutedSky.hex,
        NEDAA_LIGHT.mutedSky.hex,
        NEDAA_LIGHT.fg.hex,
        NEDAA_LIGHT.mutedSky.hex,
      ]);
      expect(style(NAMES.m).fontFamily).not.toBe(style(NAMES.s).fontFamily);
    });

    it("takes touches on the labels as well as the track", async () => {
      await show("m");

      const touch = within(screen.getByTestId(STEPPED_SLIDER_PART.TOUCH, hidden));
      expect(touch.getByTestId(STEPPED_SLIDER_PART.TRACK, hidden)).toBeOnTheScreen();
      for (const stop of STOPS) expect(touch.getByText(NAMES[stop], hidden)).toBeOnTheScreen();
    });

    it("gives the track a 44pt touch height", async () => {
      await show("m");

      expect(
        StyleSheet.flatten(screen.getByTestId(STEPPED_SLIDER_PART.TRACK, hidden).props.style).height
      ).toBeGreaterThanOrEqual(44);
    });
  });
});
