import { processColor } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { RHYTHM_ARC_PART, RhythmArc, markTestId } from "@/components/today/RhythmArc";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { RHYTHM_ARC, RHYTHM_ARC_HEIGHT, TICK_STATE } from "@/constants/Timeline";
import { renderWithTheme } from "@/test-helpers/theme";
import { arcPath, arcPoint } from "@/utils/rhythmArc";
import type { RhythmLine, RhythmMark } from "@/utils/rhythm";

const LIGHT = config.themes.light;
const WIDTH = 340;
const hidden = { includeHiddenElements: true };
/** A colour as react-native-svg hands it to the native view. */
const paint = (hex: string) => ({ type: 0, payload: processColor(hex) });

const { PASSED, CURRENT, FUTURE } = TICK_STATE;
/** Asr is in and Maghrib is next: four marks behind, two ahead. */
const MARKS: RhythmMark[] = [
  { id: PRAYER_ID.FAJR, share: 0, state: PASSED },
  { id: OTHER_TIMING.SUNRISE, share: 0.12, state: PASSED },
  { id: PRAYER_ID.DHUHR, share: 0.35, state: PASSED },
  { id: PRAYER_ID.ASR, share: 0.6, state: CURRENT },
  { id: PRAYER_ID.MAGHRIB, share: 0.85, state: FUTURE },
  { id: PRAYER_ID.ISHA, share: 1, state: FUTURE },
];
const PROGRESS: RhythmLine["progress"] = { from: 0.6, to: 0.85, fraction: 0.4 };

type Props = Partial<Parameters<typeof RhythmArc>[0]>;

const renderArc = async (props: Props = {}, isRTL = false) => {
  await renderWithTheme(
    <RhythmArc marks={MARKS} progress={PROGRESS} focus={PRAYER_ID.MAGHRIB} {...props} />,
    { isRTL }
  );
  await act(() =>
    fireEvent(screen.getByTestId(RHYTHM_ARC_PART.ROOT, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: RHYTHM_ARC_HEIGHT } },
    })
  );
};

const mark = (id: RhythmMark["id"]) => screen.getByTestId(markTestId(id), hidden);
const centreOf = (id: RhythmMark["id"]) => ({ x: mark(id).props.cx, y: mark(id).props.cy });

describe("RhythmArc", () => {
  it("draws a mark for every timing, where its share falls on the arc", async () => {
    await renderArc();

    for (const { id, share } of MARKS) {
      const at = arcPoint(share, WIDTH, false);
      expect(centreOf(id).x).toBeCloseTo(at.x);
      expect(centreOf(id).y).toBeCloseTo(at.y);
    }
  });

  it("runs the day from the end edge in RTL", async () => {
    await renderArc({}, true);

    expect(centreOf(PRAYER_ID.FAJR).x).toBeCloseTo(WIDTH - RHYTHM_ARC.inset);
    const xs = MARKS.map(({ id }) => centreOf(id).x);
    expect(xs).toEqual([...xs].sort((a, b) => b - a));
  });

  it("fills the arc from Fajr to where the day stands, in the accent", async () => {
    await renderArc();
    const done = screen.getByTestId(RHYTHM_ARC_PART.DONE, hidden);

    expect(done.props.d).toBe(arcPath(0, 0.6 + (0.85 - 0.6) * 0.4, WIDTH, false));
    expect(done.props.stroke).toEqual(paint(LIGHT.accent.val));
  });

  it("fills nothing when no stretch of the day is under way", async () => {
    await renderArc({ progress: null });

    expect(screen.queryByTestId(RHYTHM_ARC_PART.DONE, hidden)).toBeNull();
  });

  it("draws the track in the ink at a quiet strength", async () => {
    await renderArc();
    const track = screen.getByTestId(RHYTHM_ARC_PART.TRACK, hidden);

    expect(track.props.d).toBe(arcPath(0, 1, WIDTH, false));
    expect(track.props.stroke).toEqual(paint(LIGHT.fg.val));
    expect(track.props.strokeOpacity).toBe(RHYTHM_ARC.track.opacity);
  });

  // One gold for what is coming: the focus block and the cards mark it too.
  it("accents the prayer in focus and sets a soft glow behind it", async () => {
    await renderArc();
    const glow = screen.getByTestId(RHYTHM_ARC_PART.GLOW, hidden);

    expect(mark(PRAYER_ID.MAGHRIB).props.fill).toEqual(paint(LIGHT.accent.val));
    expect(mark(PRAYER_ID.MAGHRIB).props.r).toBe(RHYTHM_ARC.focus.radius);
    expect(mark(PRAYER_ID.ASR).props.fill).not.toEqual(paint(LIGHT.accent.val));
    expect(glow.props.fill).toEqual(paint(LIGHT.accentGlow.val));
    expect({ x: glow.props.cx, y: glow.props.cy }).toEqual(centreOf(PRAYER_ID.MAGHRIB));
  });

  it("quiets the marks already behind", async () => {
    await renderArc();

    expect(mark(PRAYER_ID.FAJR).props.opacity).toBe(RHYTHM_ARC.mark.pastOpacity);
    expect(mark(PRAYER_ID.ISHA).props.opacity).toBeUndefined();
  });

  it("draws sunrise smaller than a prayer", async () => {
    await renderArc();

    expect(mark(OTHER_TIMING.SUNRISE).props.r).toBeLessThan(mark(PRAYER_ID.ISHA).props.r);
  });

  it("rings the selected prayer's mark in the accent", async () => {
    await renderArc({ selected: PRAYER_ID.ISHA });

    expect(mark(PRAYER_ID.ISHA).props.stroke).toEqual(paint(LIGHT.accent.val));
    expect(mark(PRAYER_ID.FAJR).props.stroke).toEqual(paint(LIGHT.fg.val));
  });

  it("draws no glow when nothing is in focus", async () => {
    await renderArc({ focus: undefined });

    expect(screen.queryByTestId(RHYTHM_ARC_PART.GLOW, hidden)).toBeNull();
  });

  // The cards carry the names; the arc repeats none of them.
  it("writes no names, and stays out of the reader's way", async () => {
    await renderArc();
    const root = screen.getByTestId(RHYTHM_ARC_PART.ROOT, hidden);

    expect(screen.queryAllByText(/./, hidden)).toEqual([]);
    expect(root.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
