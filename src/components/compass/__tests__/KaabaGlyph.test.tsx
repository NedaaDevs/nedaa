import React from "react";
import { render, screen } from "@testing-library/react-native";

import { KaabaGlyph } from "@/components/compass/KaabaGlyph";

describe("KaabaGlyph", () => {
  it("renders at the requested size preserving aspect ratio", async () => {
    await render(<KaabaGlyph size={40} testID="kaaba" />);

    const svg = screen.getByTestId("kaaba");
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBeCloseTo((40 * 60) / 56);
  });
});
