import { NATIVE_SCHEME } from "@/constants/Appearance";
import { BRIGHTNESS, NEDAA_DARK, NEDAA_LIGHT, PHASE_GRADIENTS } from "@/constants/Palette";
import { PHASE } from "@/constants/Phase";
import {
  ADAPTIVE_SWATCH_WEIGHT,
  CELESTIAL_BODY,
  DARK_SKY,
  LIGHT_SKY,
  SKY_ARC,
} from "@/constants/Sky";
import { AppMode } from "@/enums/app";
import { isDarkMode } from "@/utils/appearance";
import processBackgroundImage from "react-native/Libraries/StyleSheet/processBackgroundImage";

import {
  arcCentre,
  discOverlaps,
  fadedDisc,
  flattenOver,
  skyBackgroundImage,
  skyScene,
  skySceneFor,
  skySwatchFor,
} from "@/utils/sky";

describe("fadedDisc", () => {
  it("fades evenly either side of the disc's edge", () => {
    const disc = fadedDisc(224, 28);

    expect(disc.radius).toBe(140);
    expect(disc.solidUntil).toBeCloseTo(0.6);
  });
});

describe("skyScene", () => {
  const hexes = (stops: readonly { color: string }[]) => stops.map((s) => s.color);

  it("draws the full daylight sky on a plain light phase", () => {
    const scene = skyScene(BRIGHTNESS.LIGHT, PHASE.DAY);

    expect(scene.base).toEqual({
      angle: 180,
      stops: LIGHT_SKY.base.map((s) => ({ offset: s.offset, color: s.color.hex })),
    });
    expect(scene.glow).not.toBeNull();
    expect(scene.horizon).not.toBeNull();
    expect(scene.sun).not.toBeNull();
    expect(scene.edgeWash).not.toBeNull();
    expect(scene.moon).toBeNull();
  });

  // The tint replaces the daylight and its glow; the sun and washes stay.
  it("tints the light sky at Asr", () => {
    const tint = PHASE_GRADIENTS[PHASE.ASR].light!;
    const scene = skyScene(BRIGHTNESS.LIGHT, PHASE.ASR);

    expect(scene.base.angle).toBe(tint.angle);
    expect(hexes(scene.base.stops)).toEqual([NEDAA_LIGHT[tint.from].hex, tint.to]);
    expect(scene.glow).toBeNull();
    expect(scene.sun).not.toBeNull();
    expect(scene.horizon).not.toBeNull();
  });

  it("draws the dark sky as its surface under the moon", () => {
    const scene = skyScene(BRIGHTNESS.DARK, PHASE.NIGHT);

    expect(hexes(scene.base.stops)).toEqual([NEDAA_DARK.surface.hex, NEDAA_DARK.surface.hex]);
    expect(scene.moon).toBe(DARK_SKY);
    expect([scene.glow, scene.horizon, scene.sun, scene.edgeWash]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("tints the dark sky at Maghrib", () => {
    const tint = PHASE_GRADIENTS[PHASE.MAGHRIB].dark!;

    expect(hexes(skyScene(BRIGHTNESS.DARK, PHASE.MAGHRIB).base.stops)).toEqual([
      NEDAA_DARK[tint.from].hex,
      tint.to,
    ]);
  });

  // A change that paints the same sky must not crossfade.
  it.each([
    ["an untinted dark Asr", BRIGHTNESS.DARK, PHASE.ASR, PHASE.NIGHT],
    ["an unknown phase", BRIGHTNESS.LIGHT, undefined, PHASE.DAY],
    ["a light night", BRIGHTNESS.LIGHT, PHASE.NIGHT, PHASE.DAY],
  ] as const)("keys %s as the plain sky", (_name, brightness, phase, plain) => {
    expect(skyScene(brightness, phase).key).toBe(skyScene(brightness, plain).key);
  });

  it("keys each painted sky apart", () => {
    const keys = [
      skyScene(BRIGHTNESS.LIGHT, PHASE.DAY),
      skyScene(BRIGHTNESS.LIGHT, PHASE.ASR),
      skyScene(BRIGHTNESS.LIGHT, PHASE.MAGHRIB),
      skyScene(BRIGHTNESS.LIGHT, PHASE.DAWN),
      skyScene(BRIGHTNESS.DARK, PHASE.NIGHT),
      skyScene(BRIGHTNESS.DARK, PHASE.MAGHRIB),
    ].map((scene) => scene.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sits an untinted sky on its palette's page colour", () => {
    expect(skyScene(BRIGHTNESS.LIGHT, PHASE.DAY).underlay).toBe(NEDAA_LIGHT.bg.hex);
    expect(skyScene(BRIGHTNESS.DARK, PHASE.NIGHT).underlay).toBe(NEDAA_DARK.bg.hex);
  });

  // The design draws its translucent tints over a near-black frame, not the page.
  it.each([PHASE.DAWN, PHASE.ASR, PHASE.MAGHRIB])(
    "sits the tinted light %s sky on the dark ground",
    (phase) => {
      expect(skyScene(BRIGHTNESS.LIGHT, phase).underlay).toBe(
        flattenOver(LIGHT_SKY.tintGround.hex, NEDAA_LIGHT.bg.hex)
      );
    }
  );
});

describe("skyBackgroundImage", () => {
  const WIDTH = 430;
  const HEIGHT = 900;
  const parsed = (css: string) => processBackgroundImage(css);

  // RN's parser drops the whole list on one bad token, so every scene must parse.
  it.each([
    ["light day", BRIGHTNESS.LIGHT, PHASE.DAY, 4],
    ["light Asr", BRIGHTNESS.LIGHT, PHASE.ASR, 3],
    ["dark night", BRIGHTNESS.DARK, PHASE.NIGHT, 3],
    ["dark Maghrib", BRIGHTNESS.DARK, PHASE.MAGHRIB, 3],
  ] as const)("paints every %s layer", (_name, brightness, phase, layers) => {
    const css = skyBackgroundImage(skyScene(brightness, phase), WIDTH, HEIGHT, false);

    expect(parsed(css)).toHaveLength(layers);
  });

  it("lists the base gradient last, so it paints at the back", () => {
    const layers = parsed(
      skyBackgroundImage(skyScene(BRIGHTNESS.LIGHT, PHASE.DAY), WIDTH, HEIGHT, false)
    );

    expect(layers.at(-1)?.type).toBe("linear-gradient");
  });

  // The wash's first stop belongs at the edge a line of text starts from.
  it.each([
    [false, 90],
    [true, 270],
  ])("turns the edge wash to the reading start (rtl: %s)", (isRTL, degrees) => {
    const [wash] = parsed(
      skyBackgroundImage(skyScene(BRIGHTNESS.LIGHT, PHASE.DAY), WIDTH, HEIGHT, isRTL)
    );

    expect(wash).toMatchObject({
      type: "linear-gradient",
      direction: { type: "angle", value: degrees },
    });
  });

  it("keeps each stop's alpha", () => {
    const [wash] = parsed(
      skyBackgroundImage(skyScene(BRIGHTNESS.LIGHT, PHASE.DAY), WIDTH, HEIGHT, false)
    );
    const alphas = wash.colorStops.map((stop: { color: number }) => (stop.color >>> 24) / 255);

    LIGHT_SKY.edgeWash.forEach(({ color }, i) =>
      expect(alphas[i]).toBeCloseTo(parseInt(color.hex.slice(7), 16) / 255, 2)
    );
  });
});

describe("arcCentre", () => {
  const W = 400;
  const H = 900;
  const PEAK = LIGHT_SKY.sun.disc.top + LIGHT_SKY.sun.disc.diameter / 2;

  it.each([
    ["rises past the start edge on the horizon", 0, SKY_ARC.start * W, SKY_ARC.horizon * H],
    ["peaks mid-sky where the prototype drew the sun", 0.5, W / 2, PEAK],
    ["sets past the end edge on the horizon", 1, SKY_ARC.end * W, SKY_ARC.horizon * H],
  ])("%s", (_name, progress, cx, cy) => {
    const got = arcCentre(progress, W, H, false);

    expect(got.cx).toBeCloseTo(cx);
    expect(got.cy).toBeCloseTo(cy);
  });

  it("rises from the right edge in a right-to-left layout", () => {
    expect(arcCentre(0.2, W, H, true).cx).toBeCloseTo(W - arcCentre(0.2, W, H, false).cx);
  });
});

describe("skyBackgroundImage with a body up", () => {
  const W = 400;
  const H = 900;
  const layersOf = (css: string) => processBackgroundImage(css);
  const lightDay = skyScene(BRIGHTNESS.LIGHT, PHASE.DAY);
  const darkNight = skyScene(BRIGHTNESS.DARK, PHASE.NIGHT);
  const sun = (progress: number) => ({ body: CELESTIAL_BODY.SUN, progress });
  const moon = (progress: number) => ({ body: CELESTIAL_BODY.MOON, progress });

  /** Light layers, front first: wash, horizon, glow, base. */
  const positionOf = (css: string, index: number) => {
    const layer = layersOf(css)[index];
    if (layer.type !== "radial-gradient") throw new Error(`layer ${index} is not radial`);
    return layer.position;
  };
  const GLOW = 2;
  const glowRest = positionOf(skyBackgroundImage(lightDay, W, H, false), GLOW);

  // The glow keeps its offset from the sun, so it moves wherever the sun goes.
  it("moves the glow along the sun's arc", () => {
    const early = skyBackgroundImage(lightDay, W, H, false, sun(0.2));
    const late = skyBackgroundImage(lightDay, W, H, false, sun(0.8));
    const moved = Number(positionOf(late, GLOW).left) - Number(positionOf(early, GLOW).left);

    expect(moved).toBeCloseTo(arcCentre(0.8, W, H, false).cx - arcCentre(0.2, W, H, false).cx);
  });

  it("rests the glow in its corner while the moon is up", () => {
    expect(positionOf(skyBackgroundImage(lightDay, W, H, false, moon(0.5)), GLOW)).toEqual(
      glowRest
    );
  });

  it("puts the moon on its arc", () => {
    const { cx } = arcCentre(0.6, W, H, false);

    expect(
      Number(positionOf(skyBackgroundImage(darkNight, W, H, false, moon(0.6)), 0).left)
    ).toBeCloseTo(cx);
  });
});

describe("flattenOver", () => {
  it.each([
    ["#00000080", "#FFFFFF", "#7F7F7F"],
    ["#FF0000", "#0000FF", "#FF0000"],
    ["#FFFFFF00", "#123456", "#123456"],
  ])("lays %s over %s as %s", (top, bottom, flat) => {
    expect(flattenOver(top, bottom)).toBe(flat);
  });
});

describe("discOverlaps", () => {
  const box = { x: 100, y: 100, width: 200, height: 40 };

  it.each([
    ["inside the box", { cx: 150, cy: 120 }, true],
    ["touching an edge", { cx: 90, cy: 120 }, true],
    ["past a corner, clear of it", { cx: 90, cy: 90 }, false],
    ["above the box", { cx: 150, cy: 60 }, false],
  ])("finds a disc %s", (_name, { cx, cy }, overlaps) => {
    expect(discOverlaps(cx, cy, 12, [box])).toBe(overlaps);
  });

  it("finds nothing with no boxes", () => {
    expect(discOverlaps(150, 120, 12, [])).toBe(false);
  });
});

const MODES = Object.values(AppMode);
const SCHEMES = [NATIVE_SCHEME.LIGHT, NATIVE_SCHEME.DARK, null] as const;
const PHASES = [...Object.values(PHASE), undefined];
const EVERY_CASE = MODES.flatMap((mode) =>
  SCHEMES.flatMap((scheme) => PHASES.map((phase) => [mode, scheme, phase] as const))
);

describe("skySceneFor", () => {
  // The sky's brightness is the app's: the same rule over every input.
  it.each(EVERY_CASE)(
    "%s on a %s phone at %s paints the app's brightness",
    (mode, scheme, phase) => {
      const dark = isDarkMode(mode, scheme, phase);

      expect(skySceneFor(mode, scheme, phase).key.startsWith(dark ? "dark:" : "light:")).toBe(true);
    }
  );

  it("tints by phase under Adaptive only", () => {
    expect(skySceneFor(AppMode.ADAPTIVE, NATIVE_SCHEME.LIGHT, PHASE.ASR)).toEqual(
      skyScene(BRIGHTNESS.LIGHT, PHASE.ASR)
    );
    expect(skySceneFor(AppMode.LIGHT, NATIVE_SCHEME.LIGHT, PHASE.ASR)).toEqual(
      skyScene(BRIGHTNESS.LIGHT, undefined)
    );
    expect(skySceneFor(AppMode.SYSTEM, NATIVE_SCHEME.DARK, PHASE.MAGHRIB)).toEqual(
      skyScene(BRIGHTNESS.DARK, undefined)
    );
  });
});

describe("skySwatchFor", () => {
  const keys = (mode: AppMode) => skySwatchFor(mode).map((band) => band.scene.key);

  it("paints a fixed mode as its own plain sky", () => {
    expect(keys(AppMode.LIGHT)).toEqual([skyScene(BRIGHTNESS.LIGHT, undefined).key]);
    expect(keys(AppMode.DARK)).toEqual([skyScene(BRIGHTNESS.DARK, undefined).key]);
  });

  it("splits System into the dark and the light sky", () => {
    expect(keys(AppMode.SYSTEM)).toEqual([
      skyScene(BRIGHTNESS.DARK, undefined).key,
      skyScene(BRIGHTNESS.LIGHT, undefined).key,
    ]);
  });

  // The day's phases in order, each as Adaptive paints it, whatever the hour.
  it("bands Adaptive by every phase in the day's order", () => {
    const bands = skySwatchFor(AppMode.ADAPTIVE);

    expect(bands.map((band) => band.scene)).toEqual(
      Object.values(PHASE).map((phase) => skySceneFor(AppMode.ADAPTIVE, null, phase))
    );
    expect(bands.map((band) => band.weight)).toEqual(
      Object.values(PHASE).map((phase) => ADAPTIVE_SWATCH_WEIGHT[phase])
    );
  });

  // One sun in the day band; a disc in every narrow band would crowd it.
  it("draws Adaptive's sun on its day band alone", () => {
    const bodies = skySwatchFor(AppMode.ADAPTIVE).map((band) => band.bodies);

    expect(bodies).toEqual(Object.values(PHASE).map((phase) => phase === PHASE.DAY));
  });

  it("draws the sun or moon on every band of the other modes", () => {
    for (const mode of [AppMode.LIGHT, AppMode.DARK, AppMode.SYSTEM]) {
      expect(skySwatchFor(mode).every((band) => band.bodies)).toBe(true);
    }
  });
});
