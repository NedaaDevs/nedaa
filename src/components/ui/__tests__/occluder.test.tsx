import React from "react";
import { Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import {
  SkyOccluderContext,
  SkyOccluder,
  SkyScrollView,
} from "@/components/ui/sky-background/occluder";
import { renderWithTheme } from "@/test-helpers/theme";

const mockMeasure = jest.fn(() => Promise.resolve({ x: 0, y: 0, width: 10, height: 10 }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => mockMeasure() }));

const SCROLL = "scroll";

// Measures again whenever the registry's epoch moves, as SkyBackground's does.
const Registry = ({ children }: { children: React.ReactNode }) => {
  const [epoch, setEpoch] = React.useState(0);
  const registry = { report: jest.fn(), epoch, remeasure: () => setEpoch((n) => n + 1) };
  return <SkyOccluderContext value={registry}>{children}</SkyOccluderContext>;
};

describe("SkyScrollView", () => {
  // Content above the scroll view can push it down without moving any block
  // within its parent, so no block's own layout event fires.
  it("has its text measured again when the scroll view itself moves", async () => {
    await renderWithTheme(
      <Registry>
        <SkyScrollView testID={SCROLL}>
          <SkyOccluder>
            <Text>Isha</Text>
          </SkyOccluder>
        </SkyScrollView>
      </Registry>
    );
    await act(async () => {});
    mockMeasure.mockClear();

    await act(async () => {
      fireEvent(screen.getByTestId(SCROLL), "layout", {
        nativeEvent: { layout: { x: 0, y: 48, width: 390, height: 700 } },
      });
    });

    expect(mockMeasure).toHaveBeenCalled();
  });
});
