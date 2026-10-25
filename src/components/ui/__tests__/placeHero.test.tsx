import { StyleSheet } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { Theme } from "tamagui";

import { HERO_NOTE_INK, PLACE_HERO_PART, PlaceHero } from "@/components/ui/place-hero";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { LiveSkyContext, useLiveSky } from "@/components/ui/sky-background/useLiveSky";
import { ELEVATION } from "@/constants/Elevation";
import { BRIGHTNESS, NEDAA_DARK, NEDAA_LIGHT, PLACE_HERO_PAINT } from "@/constants/Palette";
import { PLACE_HERO_TONE, type PlaceHeroTone } from "@/constants/PlaceHero";
import i18n from "@/localization/i18n";
import { fontSizeOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const HERO_SIZE = { width: 350, height: 160 };
const COPY = { kicker: "From your device", title: "Riyadh, Saudi Arabia", subtitle: "Times here" };

/** The page sky's own reading, with tonight's Hijri day for the moon. */
const PageSky = ({ children }: { children: React.ReactNode }) => {
  const sky = useLiveSky();
  return <LiveSkyContext value={{ ...sky, hijriDay: 14 }}>{children}</LiveSkyContext>;
};

const renderHero = async (
  tone: PlaceHeroTone = PLACE_HERO_TONE.DEVICE,
  { dark = false, title = COPY.title, isRTL = false } = {}
) => {
  const hero = <PlaceHero tone={tone} {...COPY} title={title} />;
  await renderWithTheme(dark ? <Theme name="dark">{hero}</Theme> : <PageSky>{hero}</PageSky>, {
    isRTL,
  });
  const frame = screen.getByTestId(PLACE_HERO_PART.FRAME);
  await act(async () =>
    fireEvent(frame, "layout", { nativeEvent: { layout: { x: 0, y: 0, ...HERO_SIZE } } })
  );
  return frame;
};

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style);

beforeEach(() => {
  mockReduced = false;
});

describe("PlaceHero", () => {
  it("reads as one element: the kicker, the place, then the note", async () => {
    const frame = await renderHero();

    expect(frame).toHaveProp("accessible", true);
    expect(frame).toHaveAccessibleName(
      i18n.t("a11y.join", {
        first: i18n.t("a11y.join", { first: COPY.kicker, second: COPY.title }),
        second: COPY.subtitle,
      })
    );
  });

  it("sets the place on the heading step, the note at the helper size", async () => {
    await renderHero();

    expect(screen.getByText(COPY.title)).toHaveStyle({ fontSize: fontSizeOf("heading") });
    expect(screen.getByText(COPY.subtitle)).toHaveStyle({ fontSize: fontSizeOf("helper") });
  });

  // The light skyline darkens the hero's foot, where the note sits.
  it.each([
    [BRIGHTNESS.LIGHT, false],
    [BRIGHTNESS.DARK, true],
  ])("sets the note's ink for the %s theme", async (brightness, dark) => {
    await renderHero(PLACE_HERO_TONE.DEVICE, { dark });

    expect(screen.getByText(COPY.subtitle)).toHaveStyle({ opacity: HERO_NOTE_INK[brightness] });
  });

  // A long city name wraps; the hero grows to hold it.
  it("lets a long place name wrap onto more lines", async () => {
    const long = "Saint Petersburg, Russian Federation, a long way from here";
    await renderHero(PLACE_HERO_TONE.CITY, { title: long });

    expect(screen.getByText(long).props.numberOfLines).toBeUndefined();
    expect(styleOf(PLACE_HERO_PART.FRAME).height).toBeUndefined();
  });

  it("rounds on the hero radius and rests on e1", async () => {
    await renderHero();

    expect(styleOf(PLACE_HERO_PART.FRAME)).toMatchObject({
      borderTopLeftRadius: 24,
      boxShadow: ELEVATION.e1.boxShadow.light,
    });
  });

  it.each(Object.values(PLACE_HERO_TONE))("paints the %s tint's gradient", async (tone) => {
    await renderHero(tone);

    const paint = String(styleOf(PLACE_HERO_PART.PAINT).experimental_backgroundImage);
    for (const { color, at } of PLACE_HERO_PAINT[tone].light.stops) {
      expect(paint).toContain(`${color.hex} ${at}%`);
    }
  });

  it("paints the dark tint in the dark theme", async () => {
    await renderHero(PLACE_HERO_TONE.CITY, { dark: true });

    const paint = String(styleOf(PLACE_HERO_PART.PAINT).experimental_backgroundImage);
    expect(paint).toContain(PLACE_HERO_PAINT.city.dark.stops[0].color.hex);
  });

  it("draws the skyline at its foot, hidden from the reader", async () => {
    await renderHero();

    expect(screen.queryByTestId(PLACE_HERO_PART.SKYLINE)).toBeNull();
    expect(
      screen.getByTestId(PLACE_HERO_PART.SKYLINE, { includeHiddenElements: true })
    ).toBeTruthy();
  });

  // The page sky holds the one sun or moon; the hero must not add a second.
  it("draws no sun of its own by day", async () => {
    const frame = await renderHero();

    expect(within(frame).queryByTestId(SKY_PART.SUN, { includeHiddenElements: true })).toBeNull();
    expect(within(frame).queryByTestId(SKY_PART.MOON, { includeHiddenElements: true })).toBeNull();
  });

  it("draws no moon of its own in the dark theme", async () => {
    const hero = <PlaceHero tone={PLACE_HERO_TONE.DEVICE} {...COPY} />;
    await renderWithTheme(
      <Theme name="dark">
        <PageSky>{hero}</PageSky>
      </Theme>
    );
    const frame = screen.getByTestId(PLACE_HERO_PART.FRAME);
    await act(async () =>
      fireEvent(frame, "layout", { nativeEvent: { layout: { x: 0, y: 0, ...HERO_SIZE } } })
    );

    expect(within(frame).queryByTestId(SKY_PART.MOON, { includeHiddenElements: true })).toBeNull();
    expect(within(frame).queryByTestId(SKY_PART.SUN, { includeHiddenElements: true })).toBeNull();
  });

  it.each([false, true])("keeps its scenery to the skyline (rtl: %s)", async (isRTL) => {
    await renderHero(PLACE_HERO_TONE.DEVICE, { isRTL });

    expect(
      screen.getByTestId(PLACE_HERO_PART.SCENERY, { includeHiddenElements: true })
    ).toContainElement(
      screen.getByTestId(PLACE_HERO_PART.SKYLINE, { includeHiddenElements: true })
    );
    expect(screen.queryByTestId(SKY_PART.SUN_RAYS, { includeHiddenElements: true })).toBeNull();
  });

  it("has nothing in motion under Reduce Motion", async () => {
    mockReduced = true;
    await renderHero();

    expect(screen.queryByTestId(SKY_PART.SUN_RAYS, { includeHiddenElements: true })).toBeNull();
  });

  it.each([
    ["light", NEDAA_LIGHT, false],
    ["dark", NEDAA_DARK, true],
  ] as const)("sets its copy in the %s theme's ink", async (_theme, palette, dark) => {
    await renderHero(PLACE_HERO_TONE.DEVICE, { dark });

    expect(screen.getByText(COPY.title)).toHaveStyle({ color: palette.fg.hex });
    expect(screen.getByText(COPY.subtitle)).toHaveStyle({ color: palette.fg.hex });
  });
});
