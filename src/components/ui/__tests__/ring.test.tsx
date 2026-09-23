import type { ReactTestRendererJSON } from "react-test-renderer";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Ring } from "@/components/ui/ring";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;
const CIRCLE = "RNSVGCircle";

/** The host circles in paint order: the track, then the arc. */
const circles = () => {
  const found: ReactTestRendererJSON[] = [];
  const walk = (node: ReturnType<typeof screen.toJSON>) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === CIRCLE) found.push(node);
    node.children?.forEach((child) => typeof child !== "string" && walk(child));
  };
  walk(screen.toJSON());
  return found;
};

/** The share of the circumference the arc paints. */
const drawnFraction = () => {
  const { strokeDasharray, strokeDashoffset } = circles()[1].props;
  return 1 - strokeDashoffset / strokeDasharray[0];
};

describe("Ring", () => {
  it.each([
    [0.4, 0.4],
    [1.7, 1],
    [-0.2, 0],
  ])("draws %s as %s of the circle", async (progress, fraction) => {
    await renderWithTheme(<Ring progress={progress} />);

    expect(drawnFraction()).toBeCloseTo(fraction);
  });

  // A token the ring failed to resolve would reach the SVG unparsed and draw nothing.
  it("strokes with the theme's accent by default", async () => {
    await renderWithTheme(
      <>
        <Ring progress={0.4} color={LIGHT.accentPrimary.val} />
        <Ring progress={0.4} />
      </>
    );
    const strokes = circles().map((circle) => circle.props.stroke);

    // Two circles per ring: the explicit ring's pair, then the default's.
    expect(strokes.slice(2)).toEqual(strokes.slice(0, 2));
  });
});
