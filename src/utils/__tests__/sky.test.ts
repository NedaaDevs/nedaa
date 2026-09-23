import { BRIGHTNESS, NEDAA_DARK, NEDAA_LIGHT, PHASE_GRADIENTS } from "@/constants/Palette";
import { PHASE } from "@/constants/Phase";
import { DARK_SKY, LIGHT_SKY } from "@/constants/Sky";
import processBackgroundImage from "react-native/Libraries/StyleSheet/processBackgroundImage";

import { fadedDisc, skyBackgroundImage, skyScene } from "@/utils/sky";

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

  it("sits every sky on its palette's page colour", () => {
    expect(skyScene(BRIGHTNESS.LIGHT, PHASE.ASR).underlay).toBe(NEDAA_LIGHT.bg.hex);
    expect(skyScene(BRIGHTNESS.DARK, PHASE.NIGHT).underlay).toBe(NEDAA_DARK.bg.hex);
  });
});

describe("skyBackgroundImage", () => {
  const WIDTH = 430;
  const HEIGHT = 900;
  const parsed = (css: string) => processBackgroundImage(css);

  // RN's parser drops the whole list on one bad token, so every scene must parse.
  it.each([
    ["light day", BRIGHTNESS.LIGHT, PHASE.DAY, 5],
    ["light Asr", BRIGHTNESS.LIGHT, PHASE.ASR, 4],
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
