import { Animated, processColor } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { BOWL_PART, Bowl, bowlMarkTestId } from "@/components/today/Bowl";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { BODY_BEHIND_TEXT, CELESTIAL_BODY, MOON_GLYPH, SUN_GLYPH } from "@/constants/Sky";
import { BOWL, TICK_STATE } from "@/constants/Timeline";
import { renderWithTheme } from "@/test-helpers/theme";
import { bowlPath, bowlPoint } from "@/utils/bowl";
import type { RhythmLine } from "@/utils/rhythm";

const LIGHT = config.themes.light;
const [WIDTH, HEIGHT] = [320, 160];
const hidden = { includeHiddenElements: true };
/** A colour as react-native-svg hands it to the native view. */
const paint = (hex: string) => ({ type: 0, payload: processColor(hex) });

const { PASSED, CURRENT, FUTURE } = TICK_STATE;
/** Asr is in and Maghrib is next. */
const DAY_LINE: RhythmLine = {
  marks: [
    { id: PRAYER_ID.FAJR, share: 0, state: PASSED },
    { id: OTHER_TIMING.SUNRISE, share: 0.12, state: PASSED },
    { id: PRAYER_ID.DHUHR, share: 0.35, state: PASSED },
    { id: PRAYER_ID.ASR, share: 0.6, state: CURRENT },
    { id: PRAYER_ID.MAGHRIB, share: 0.85, state: FUTURE },
    { id: PRAYER_ID.ISHA, share: 1, state: FUTURE },
  ],
  now: 0.7,
  night: null,
  focus: PRAYER_ID.MAGHRIB,
};
/** Past midnight, the last third still to come, Fajr next. */
const NIGHT_LINE: RhythmLine = {
  marks: DAY_LINE.marks.map((mark) => ({ ...mark, state: PASSED })),
  now: 0.4,
  night: [
    { id: OTHER_TIMING.MIDNIGHT, share: 0.47, state: CURRENT },
    { id: OTHER_TIMING.LAST_THIRD, share: 0.33, state: FUTURE },
  ],
  focus: PRAYER_ID.FAJR,
};
const FEET = { start: "Fajr", end: "Isha" };
const SUN = { body: CELESTIAL_BODY.SUN } as const;

type Props = Partial<Parameters<typeof Bowl>[0]>;

const renderBowl = (props: Props = {}, isRTL = false) =>
  renderWithTheme(
    <Bowl line={DAY_LINE} width={WIDTH} height={HEIGHT} body={SUN} feet={FEET} {...props} />,
    { isRTL }
  );

const mark = (id: string) => screen.getByTestId(bowlMarkTestId(id), hidden);
const part = (id: string) => screen.queryAllByTestId(id, hidden);
const at = (share: number, isRTL = false) => bowlPoint(share, WIDTH, HEIGHT, isRTL);
/** A tick's middle, or a dot's centre. */
const centreOf = (id: string) => {
  const { props } = mark(id);
  return props.cx !== undefined
    ? { x: props.cx, y: props.cy }
    : { x: (props.x1 + props.x2) / 2, y: (props.y1 + props.y2) / 2 };
};

describe("Bowl by day", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ticks sunrise, Dhuhr, Asr and Maghrib where their share falls on the rim", async () => {
    await renderBowl();

    for (const { id, share } of DAY_LINE.marks) {
      expect(centreOf(id).x).toBeCloseTo(at(share).x);
      expect(centreOf(id).y).toBeCloseTo(at(share).y);
    }
  });

  it("runs the day from the end edge in RTL", async () => {
    await renderBowl({}, true);

    expect(centreOf(PRAYER_ID.FAJR).x).toBeCloseTo(WIDTH - BOWL.inset);
    const xs = DAY_LINE.marks.map(({ id }) => centreOf(id).x);
    expect(xs).toEqual([...xs].sort((a, b) => b - a));
  });

  it("dashes the whole rim in the ink at a quiet strength", async () => {
    await renderBowl();
    const track = screen.getByTestId(BOWL_PART.TRACK, hidden);

    expect(track.props.d).toBe(bowlPath(0, 1, WIDTH, HEIGHT, false));
    expect(track.props.stroke).toEqual(paint(LIGHT.fg.val));
    expect(track.props.strokeOpacity).toBe(BOWL.track.opacity);
    expect(track.props.strokeDasharray).toEqual(BOWL.track.dash);
  });

  it("lights the rim from the Fajr foot to now", async () => {
    await renderBowl();
    const lit = screen.getByTestId(BOWL_PART.LIT, hidden);

    expect(lit.props.d).toBe(bowlPath(0, DAY_LINE.now, WIDTH, HEIGHT, false));
    expect(lit.props.stroke).toEqual(paint(LIGHT.trail.val));
  });

  it("lights nothing before Fajr", async () => {
    await renderBowl({ line: { ...DAY_LINE, now: 0 } });

    expect(part(BOWL_PART.LIT)).toHaveLength(0);
  });

  // One gold for what is coming: the countdown and the cards mark it too.
  it("glows the next prayer's mark in the accent", async () => {
    await renderBowl();
    const [glow] = part(BOWL_PART.GLOW);

    expect(mark(PRAYER_ID.MAGHRIB).props.fill).toEqual(paint(LIGHT.accent.val));
    expect(mark(PRAYER_ID.MAGHRIB).props.r).toBe(BOWL.focus.radius);
    expect(glow.props.fill).toEqual(paint(LIGHT.accent.val));
    expect(glow.props.opacity).toBe(BOWL.focus.glowOpacity);
    expect({ x: glow.props.cx, y: glow.props.cy }).toEqual(centreOf(PRAYER_ID.MAGHRIB));
    expect(mark(PRAYER_ID.ASR).props.stroke).toEqual(paint(LIGHT.fg.val));
  });

  it("glows a foot when its prayer is next", async () => {
    await renderBowl({ line: { ...DAY_LINE, now: 0.95, focus: PRAYER_ID.ISHA } });

    expect(mark(PRAYER_ID.ISHA).props.fill).toEqual(paint(LIGHT.accent.val));
    expect(screen.getByText(FEET.end, hidden)).toHaveStyle({ color: LIGHT.accentText.val });
    expect(screen.getByText(FEET.start, hidden)).toHaveStyle({ color: LIGHT.mutedSky.val });
  });

  it("draws no glow when nothing is in focus", async () => {
    await renderBowl({ line: { ...DAY_LINE, focus: null } });

    expect(part(BOWL_PART.GLOW)).toHaveLength(0);
  });

  it("quiets the ticks already behind", async () => {
    await renderBowl();

    expect(mark(PRAYER_ID.DHUHR).props.strokeOpacity).toBe(BOWL.tick.pastOpacity);
    expect(mark(PRAYER_ID.ASR).props.strokeOpacity).toBe(BOWL.tick.pastOpacity);
    expect(mark(PRAYER_ID.MAGHRIB).props.opacity).toBeUndefined();
  });

  it("ticks sunrise shorter than a prayer", async () => {
    await renderBowl();
    const length = (id: string) => {
      const { x1, y1, x2, y2 } = mark(id).props;
      return Math.hypot(x2 - x1, y2 - y1);
    };

    expect(length(OTHER_TIMING.SUNRISE)).toBeLessThan(length(PRAYER_ID.DHUHR));
  });

  it.each([PRAYER_ID.ASR, PRAYER_ID.FAJR])(
    "rings the chosen prayer, %s, in the accent",
    async (id) => {
      await renderBowl({ selected: id });
      const ring = screen.getByTestId(BOWL_PART.SELECTED, hidden);

      expect(ring.props.stroke).toEqual(paint(LIGHT.accent.val));
      expect({ x: ring.props.cx, y: ring.props.cy }).toEqual({
        x: at(DAY_LINE.marks.find((each) => each.id === id)!.share).x,
        y: at(DAY_LINE.marks.find((each) => each.id === id)!.share).y,
      });
    }
  );

  // Only the feet are named; the cards carry every other name.
  it("names the two feet and nothing else", async () => {
    await renderBowl();

    expect(screen.queryAllByText(/./, hidden).map((node) => node.props.children)).toEqual([
      FEET.start,
      FEET.end,
    ]);
    expect(screen.getByTestId(BOWL_PART.FOOT_START, hidden)).toHaveStyle({ start: 0 });
    expect(screen.getByTestId(BOWL_PART.FOOT_END, hidden)).toHaveStyle({ end: 0 });
    // A name no wider than its box centres beside its foot, nudged inward.
    expect(screen.getByTestId(BOWL_PART.FOOT_START, hidden)).toHaveStyle({
      minWidth: 2 * (BOWL.inset + BOWL.footNudge),
    });
  });

  it("sets the sun on the rim at now, small, its rays still", async () => {
    const turns = jest.spyOn(Animated, "loop");
    await renderBowl();
    const pad = SUN_GLYPH.bloom * (BOWL.body / SUN_GLYPH.core);
    const circles = screen.container.queryAll((node) => node.type === "RNSVGCircle");
    const core = circles.find((node) => node.props.r === BOWL.body)!;

    expect(core.props.cx).toBeCloseTo(at(DAY_LINE.now).x + pad);
    expect(core.props.cy).toBeCloseTo(at(DAY_LINE.now).y + pad);
    // Jest never steps a native-driver animation, so still rays start no turn.
    expect(turns).not.toHaveBeenCalled();
  });

  it("stays out of the reader's way", async () => {
    await renderBowl();

    expect(screen.getByTestId(BOWL_PART.ROOT, hidden).props.importantForAccessibility).toBe(
      "no-hide-descendants"
    );
  });
});

describe("Bowl by night", () => {
  const MOON = { body: CELESTIAL_BODY.MOON, phase: 0.4 } as const;
  const renderNight = (props: Props = {}, isRTL = false) =>
    renderBowl({ line: NIGHT_LINE, body: MOON, ...props }, isRTL);

  it("ticks midnight and the last third, and no prayer between the feet", async () => {
    await renderNight();

    for (const { id, share } of NIGHT_LINE.night!) {
      expect(centreOf(id).x).toBeCloseTo(at(share).x);
    }
    expect(part(bowlMarkTestId(PRAYER_ID.ASR))).toHaveLength(0);
    expect(part(bowlMarkTestId(OTHER_TIMING.SUNRISE))).toHaveLength(0);
    expect(mark(OTHER_TIMING.MIDNIGHT).props.strokeOpacity).toBe(BOWL.tick.pastOpacity);
    expect(mark(OTHER_TIMING.LAST_THIRD).props.strokeOpacity).toBe(BOWL.tick.opacity);
  });

  it("lights the rim from the moon back to the Isha foot", async () => {
    await renderNight();

    expect(screen.getByTestId(BOWL_PART.LIT, hidden).props.d).toBe(
      bowlPath(NIGHT_LINE.now, 1, WIDTH, HEIGHT, false)
    );
  });

  it("glows the Fajr foot as next", async () => {
    await renderNight();

    expect(mark(PRAYER_ID.FAJR).props.fill).toEqual(paint(LIGHT.accent.val));
    expect(screen.getByText(FEET.start, hidden)).toHaveStyle({ color: LIGHT.accentText.val });
  });

  it("sets the moon on the rim at now, small", async () => {
    await renderNight({}, true);
    const r = BOWL.body;
    const box = 2 * r * MOON_GLYPH.halo.reach;
    const pad = SUN_GLYPH.bloom * (BOWL.body / SUN_GLYPH.core);
    const { x, y } = at(NIGHT_LINE.now, true);

    expect(screen.getByTestId(SKY_PART.MOON_BODY, hidden).props.r).toBeCloseTo(r);
    expect(screen.getByTestId(SKY_PART.MOON, hidden)).toHaveStyle({
      transform: [{ translateX: x + pad - box / 2 }, { translateY: y + pad - box / 2 }],
    });
  });

  // Text always shares the bowl with the moon, so it fades as behind text.
  it("fades the moon as the sky does behind text", async () => {
    await renderNight();

    expect(screen.getByTestId(BOWL_PART.BODY, hidden)).toHaveStyle({
      opacity: BODY_BEHIND_TEXT.opacity,
    });
  });

  it("draws the sun at full strength", async () => {
    await renderBowl();

    expect(screen.getByTestId(BOWL_PART.BODY, hidden)).toHaveStyle({ opacity: 1 });
  });

  it("draws no body when none is given", async () => {
    await renderNight({ body: null });

    expect(part(SKY_PART.MOON)).toHaveLength(0);
    expect(part(SKY_PART.SUN)).toHaveLength(0);
  });
});
