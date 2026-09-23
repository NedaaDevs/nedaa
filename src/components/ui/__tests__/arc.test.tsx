import { Dimensions, processColor, Text } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import {
  ARC_LABEL,
  ARC_PART,
  Arc,
  ArcLabels,
  type ArcSegment,
  type ArcTick,
} from "@/components/ui/arc";
import { SEGMENT_TONE, TICK_STATE } from "@/constants/Arc";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;

const TICKS: ArcTick[] = [
  { id: "a", x: 10, y: 40, state: TICK_STATE.PASSED },
  { id: "b", x: 100, y: 10, state: TICK_STATE.CURRENT },
  { id: "c", x: 190, y: 40, state: TICK_STATE.FUTURE },
];

const renderArc = (
  props: Partial<{ segments: ArcSegment[]; selected: string; now: { x: number; y: number } }> = {}
) =>
  renderWithTheme(
    <Arc
      draw={() => ({
        track: "M 10 40 L 100 10 L 190 40",
        horizon: { y: 40, from: 10, to: 190 },
        ticks: TICKS,
        segments: props.segments ?? [],
        now: props.now ?? null,
      })}
      selected={props.selected}
    />
  );

const all = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });

/** The ARGB a host shape paints its fill or stroke with. */
const paint = (value: { payload: number } | undefined) => value?.payload;
const argb = (hex: string) => processColor(hex) as number;

const tickFill = (index: number) => paint(all(ARC_PART.TICK)[index].props.fill);

describe("Arc", () => {
  it("draws a mark for each tick, out of the screen reader's way", async () => {
    await renderArc();

    expect(all(ARC_PART.TICK)).toHaveLength(TICKS.length);
    expect(screen.queryAllByTestId(ARC_PART.TICK)).toHaveLength(0);
  });

  it("fills the current tick with the accent", async () => {
    await renderArc();

    expect(tickFill(1)).toBe(argb(LIGHT.accent.val));
    expect(tickFill(2)).not.toBe(argb(LIGHT.accent.val));
  });

  it("fills a selected tick with the accent, even ahead of now", async () => {
    await renderArc({ selected: "c" });

    expect(tickFill(2)).toBe(argb(LIGHT.accent.val));
  });

  it("draws passed stretches muted and the selected one in the accent", async () => {
    await renderArc({
      segments: [
        { id: "a", d: "M 10 40 L 100 10", tone: SEGMENT_TONE.PASSED },
        { id: "c", d: "M 100 10 L 190 40", tone: SEGMENT_TONE.SELECTED },
      ],
    });

    const strokes = all(ARC_PART.SEGMENT).map((node) => paint(node.props.stroke));

    expect(strokes).toEqual([argb(LIGHT.muted.val), argb(LIGHT.accent.val)]);
  });

  it("rings the current moment only when it is on the line", async () => {
    await renderArc();
    expect(all(ARC_PART.NOW)).toHaveLength(0);

    await renderArc({ now: { x: 120, y: 12 } });
    expect(all(ARC_PART.NOW)).toHaveLength(1);
  });

  it("dashes the horizon", async () => {
    await renderArc();

    expect(all(ARC_PART.HORIZON)[0].props.strokeDasharray).toBeTruthy();
  });
});

describe("ArcLabels", () => {
  const labelBox = (text: string) =>
    Object.assign(
      {},
      ...[screen.getByText(text, { includeHiddenElements: true }).parent!.props.style].flat(
        Infinity
      )
    );

  it("centres each label on its share of the width, on its row", async () => {
    await renderWithTheme(
      <ArcLabels
        labels={[
          { id: "a", share: 0.1, row: 0, children: <Text>A</Text> },
          { id: "b", share: 0.5, row: 1, children: <Text>B</Text> },
        ]}
      />
    );

    // Until its first layout the row spans the window.
    const width = Dimensions.get("window").width;

    expect(labelBox("A")).toMatchObject({ start: 0.1 * width - ARC_LABEL.width / 2, top: 0 });
    expect(labelBox("B")).toMatchObject({
      start: 0.5 * width - ARC_LABEL.width / 2,
      top: ARC_LABEL.row,
    });
  });
});
