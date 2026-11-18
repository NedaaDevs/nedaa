import { screen, within } from "@testing-library/react-native";

import {
  LOOK_PICTURE,
  LOOK_PREVIEW_PART,
  LookPicture,
  LookPreview,
} from "@/components/athkar/looks/LookPreview";
import { HORIZON_ARC_PART } from "@/components/athkar/looks/horizon/HorizonArc";
import { SUBHA_STRING_PART } from "@/components/athkar/looks/subha/SubhaString";
import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { ATHKAR_LOOK } from "@/constants/AthkarLook";
import { SESSION_STATUS } from "@/constants/AthkarSession";
import i18n from "@/localization/i18n";
import { TEST_LOOK_ID, TEST_LOOK_PART } from "@/test-helpers/athkarLooks";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);

/** The preview hides from a screen reader; these queries look anyway. */
const DRAWN = { includeHiddenElements: true } as const;

describe("the sample session", () => {
  it("is a dhikr part way through its count, with one after it", () => {
    const { status, current, next } = SAMPLE_SESSION;
    expect(status).toBe(SESSION_STATUS.READY);
    expect(current?.count).toBeGreaterThan(0);
    expect(current?.count).toBeLessThan(current?.target ?? 0);
    expect(i18n.exists(current?.textKey ?? "")).toBe(true);
    expect(next).not.toBeNull();
  });
});

describe("LookPreview", () => {
  it("draws the look it is given, tried on, over the sample", async () => {
    await renderWithTheme(<LookPreview look={TEST_LOOK_ID} />);
    expect(screen.getByTestId(TEST_LOOK_PART.TRYING, DRAWN)).toBeOnTheScreen();
    expect(screen.getByTestId(TEST_LOOK_PART.COUNT, DRAWN)).toHaveTextContent(
      `${SAMPLE_SESSION.current?.count}`
    );
  });

  it("draws the Classic look, which needs no sky", async () => {
    await renderWithTheme(<LookPreview look={ATHKAR_LOOK.CLASSIC} />);
    expect(
      screen.getAllByText(new RegExp(`${SAMPLE_SESSION.current?.count}`), DRAWN)[0]
    ).toBeOnTheScreen();
  });

  it("takes the page sky's sun for a look that draws its own", async () => {
    await renderWithTheme(
      <SkyBackground>
        <LookPreview look={ATHKAR_LOOK.HORIZON} />
      </SkyBackground>
    );
    expect(screen.queryAllByTestId(SKY_PART.BODIES, DRAWN)).toHaveLength(0);
  });

  it("leaves the page sky its sun for a look that draws none", async () => {
    await renderWithTheme(
      <SkyBackground>
        <LookPreview look={ATHKAR_LOOK.SUBHA} />
      </SkyBackground>
    );
    expect(screen.getByTestId(SUBHA_STRING_PART.STRING, DRAWN)).toBeOnTheScreen();
    expect(screen.queryAllByTestId(SKY_PART.BODIES, DRAWN)).toHaveLength(1);
  });

  it("is a picture: nothing in it is read or pressed", async () => {
    await renderWithTheme(<LookPreview look={TEST_LOOK_ID} />);
    expect(screen.queryByTestId(TEST_LOOK_PART.READER)).toBeNull();
    expect(screen.getByTestId(LOOK_PREVIEW_PART.ROOT, DRAWN)).toHaveProp("pointerEvents", "none");
  });
});

describe("LookPicture", () => {
  it("draws the look on a sky of its own", async () => {
    await renderWithTheme(<LookPicture look={ATHKAR_LOOK.CLASSIC} />);
    expect(screen.getAllByTestId(SKY_PART.CANVAS, DRAWN)).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.BODIES, DRAWN)).toHaveLength(1);
  });

  it("draws the Horizon look with one sun, the look's", async () => {
    await renderWithTheme(<LookPicture look={ATHKAR_LOOK.HORIZON} />);
    expect(screen.getAllByTestId(SKY_PART.CANVAS, DRAWN)).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.BODIES, DRAWN)).toHaveLength(0);
    expect(screen.getAllByTestId(HORIZON_ARC_PART.SUN, DRAWN)).toHaveLength(1);
  });

  it("draws the Subha look under the sky's own sun", async () => {
    await renderWithTheme(<LookPicture look={ATHKAR_LOOK.SUBHA} />);
    expect(screen.getAllByTestId(SKY_PART.CANVAS, DRAWN)).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.BODIES, DRAWN)).toHaveLength(1);
    expect(screen.getByTestId(SUBHA_STRING_PART.STRING, DRAWN)).toBeOnTheScreen();
  });

  it("scales a reader of the design's size into a frame of the same shape", async () => {
    await renderWithTheme(<LookPicture look={TEST_LOOK_ID} />);
    const { WIDTH, HEIGHT, SCALE } = LOOK_PICTURE;
    expect(screen.getByTestId(LOOK_PREVIEW_PART.PICTURE)).toHaveStyle({
      width: WIDTH * SCALE,
      height: HEIGHT * SCALE,
      overflow: "hidden",
    });
    const stage = screen.getByTestId(LOOK_PREVIEW_PART.STAGE, DRAWN);
    expect(stage).toHaveStyle({
      width: WIDTH,
      height: HEIGHT,
      transform: [{ scale: SCALE }],
    });
    expect(within(stage).getByTestId(TEST_LOOK_PART.READER, DRAWN)).toBeOnTheScreen();
  });
});
