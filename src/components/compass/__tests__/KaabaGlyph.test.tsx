import React from "react";
import renderer, { act } from "react-test-renderer";
import { Svg } from "react-native-svg";

import { KaabaGlyph } from "@/components/compass/KaabaGlyph";

describe("KaabaGlyph", () => {
  it("renders at the requested size preserving aspect ratio", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<KaabaGlyph size={40} testID="kaaba" />);
    });

    const svg = tree.root.findByType(Svg);
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBeCloseTo((40 * 60) / 56);

    act(() => tree.unmount());
  });
});
