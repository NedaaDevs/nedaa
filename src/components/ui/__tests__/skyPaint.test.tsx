import { act, screen } from "@testing-library/react-native";

import { SKY_PART } from "@/components/ui/sky-background";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { ThemeDissolvingContext } from "@/components/ui/theme-transition/context";
import { DURATION_MS } from "@/constants/Motion";
import { BRIGHTNESS } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";
import { skyBackgroundImage, skyScene, type SkyScene } from "@/utils/sky";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const part = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });

type PaintStyle = {
  backgroundColor: string;
  experimental_backgroundImage: string;
  width?: number;
  transform?: { scale: number }[];
};

const paints = (): PaintStyle[] =>
  part(SKY_PART.PAINT).map((node) => Object.assign({}, ...[node.props.style].flat(Infinity)));

const SIZE = { width: 300, height: 200 };
const LIGHT = skyScene(BRIGHTNESS.LIGHT, undefined);
const DARK = skyScene(BRIGHTNESS.DARK, undefined);

const Paint = ({
  scene,
  scale,
  bodies,
  testID,
}: {
  scene: SkyScene;
  scale?: number;
  bodies?: boolean;
  testID?: string;
}) => (
  <SkyPaint
    scene={scene}
    celestial={undefined}
    hijriDay={3}
    isRTL={false}
    reduced={mockReduced}
    {...SIZE}
    scale={scale}
    bodies={bodies}
    testID={testID}
  />
);

describe("SkyPaint", () => {
  beforeEach(() => {
    mockReduced = false;
  });

  it("paints the scene it is given, hidden from the screen reader", async () => {
    await renderWithTheme(<Paint scene={LIGHT} />);

    expect(screen.queryByTestId(SKY_PART.CANVAS)).toBeNull();
    expect(part(SKY_PART.CANVAS)).toHaveLength(1);
    expect(paints()).toEqual([
      expect.objectContaining({
        backgroundColor: LIGHT.underlay,
        experimental_backgroundImage: skyBackgroundImage(LIGHT, SIZE.width, SIZE.height, false),
      }),
    ]);
  });

  // A preview beside the page sky must not read as a second page sky.
  it("names its canvas by the id it is given", async () => {
    await renderWithTheme(<Paint scene={LIGHT} testID="preview" />);

    expect(part(SKY_PART.CANVAS)).toHaveLength(0);
    expect(part("preview")).toHaveLength(1);
  });

  // Drawn larger and shrunk, so a small frame keeps the sky's proportions.
  it("paints a scaled sky at its full size, shrunk to the frame", async () => {
    await renderWithTheme(<Paint scene={LIGHT} scale={0.5} />);
    const [paint] = paints();

    expect(paint.width).toBe(SIZE.width / 0.5);
    expect(paint.transform).toEqual([{ scale: 0.5 }]);
    expect(paint.experimental_backgroundImage).toBe(
      skyBackgroundImage(LIGHT, SIZE.width / 0.5, SIZE.height / 0.5, false)
    );
  });

  it("leaves out the sun and moon when asked", async () => {
    await renderWithTheme(<Paint scene={LIGHT} bodies={false} />);

    expect(part(SKY_PART.SUN)).toHaveLength(0);
  });

  describe("crossfade", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("holds the old sky under a new one while it fades in, then drops it", async () => {
      const { rerender } = await renderWithTheme(<Paint scene={LIGHT} />);

      await rerender(<Paint scene={DARK} />);
      expect(paints().map((paint) => paint.backgroundColor)).toEqual([
        LIGHT.underlay,
        DARK.underlay,
      ]);

      await act(() => jest.advanceTimersByTime(DURATION_MS.SKY + 100));
      expect(paints().map((paint) => paint.backgroundColor)).toEqual([DARK.underlay]);
    });

    // A theme dissolve already covers the change with its snapshot.
    it("swaps at once while a theme dissolve runs", async () => {
      const Dissolving = ({ scene }: { scene: SkyScene }) => (
        <ThemeDissolvingContext value={true}>
          <Paint scene={scene} />
        </ThemeDissolvingContext>
      );
      const { rerender } = await renderWithTheme(<Dissolving scene={LIGHT} />);

      await rerender(<Dissolving scene={DARK} />);

      expect(paints().map((paint) => paint.backgroundColor)).toEqual([DARK.underlay]);
    });

    it("swaps at once under Reduce Motion", async () => {
      mockReduced = true;
      const { rerender } = await renderWithTheme(<Paint scene={LIGHT} />);

      await rerender(<Paint scene={DARK} />);

      expect(paints().map((paint) => paint.backgroundColor)).toEqual([DARK.underlay]);
    });
  });
});
