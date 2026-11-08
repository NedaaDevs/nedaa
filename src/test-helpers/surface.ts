import { StyleSheet } from "react-native";
import { within } from "@testing-library/react-native";

import { NEDAA_LIGHT } from "@/constants/Palette";
import { ELEVATION } from "@/constants/Elevation";
import type { HostElement } from "@/test-helpers/text";

const HIGHLIGHT = /highlight/;

const rests = (element: HostElement) =>
  StyleSheet.flatten(element.props.style)?.boxShadow === ELEVATION.e1.boxShadow.light;

/** The nearest element, from this one outward, that draws the e1 lift. */
export const restingSurfaceOf = (element: HostElement): HostElement | null => {
  for (let node: HostElement | null = element; node; node = node.parent) {
    if (rests(node)) return node;
  }
  return null;
};

/** Fails unless the element sits on a glass card with no drawn line and a lit edge. */
export const expectOnRestingSurface = (element: HostElement) => {
  const surface = restingSurfaceOf(element);
  expect(surface).not.toBeNull();
  const style = StyleSheet.flatten(surface!.props.style);
  // A clear edge that holds a selected ring's place draws no line.
  if (style.borderTopWidth) expect(style.borderTopColor).toBe("transparent");
  expect(style.backgroundColor).toBe(NEDAA_LIGHT.surfaceGlass.hex);
  expect(
    within(surface!).getAllByTestId(HIGHLIGHT, { includeHiddenElements: true }).length
  ).toBeGreaterThan(0);
};
