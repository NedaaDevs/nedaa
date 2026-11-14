import React from "react";
import { Platform, Text } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";

import {
  SkyOccluderContext,
  SkyOccluder,
  SkyScrollView,
} from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { UnderStatusBarContext } from "@/contexts/UnderStatusBarContext";
import { PlatformType } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";
import { statusBarFade, statusBarMaskImage } from "@/utils/sky";

const mockMeasure = jest.fn(() => Promise.resolve({ x: 0, y: 0, width: 10, height: 10 }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => mockMeasure() }));

let mockReduceTransparency = false;
jest.mock("@/hooks/useReduceTransparency", () => ({
  useReduceTransparency: () => mockReduceTransparency,
}));

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

  describe("under the status bar", () => {
    const INSET_TOP = 62;
    const renderUnder = (insetTop: number | null) =>
      renderWithTheme(
        <UnderStatusBarContext value={insetTop}>
          <SkyScrollView testID={SCROLL} />
        </UnderStatusBarContext>
      );

    beforeEach(() => {
      mockReduceTransparency = false;
    });

    it("hides its content under the status bar, then fades it in", async () => {
      await renderUnder(INSET_TOP);
      const fade = statusBarFade({ insetTop: INSET_TOP, reduceTransparency: false });

      expect(within(screen.getByTestId(SKY_PART.STATUS_BAR_MASK)).getByTestId(SCROLL)).toBeTruthy();
      expect(screen.getByTestId(SKY_PART.STATUS_BAR_MASK_IMAGE)).toHaveStyle({
        experimental_backgroundImage: statusBarMaskImage(fade),
      });
    });

    it("cuts its content at the status bar under Reduce Transparency", async () => {
      mockReduceTransparency = true;
      await renderUnder(INSET_TOP);

      expect(screen.getByTestId(SKY_PART.STATUS_BAR_MASK_IMAGE)).toHaveStyle({
        experimental_backgroundImage: statusBarMaskImage({ hidden: INSET_TOP, ramp: 0 }),
      });
    });

    // Onboarding pads its frame clear of the status bar.
    it("draws its content whole below a padded top", async () => {
      await renderUnder(null);

      expect(screen.queryByTestId(SKY_PART.STATUS_BAR_MASK)).toBeNull();
    });

    describe("on Android", () => {
      // A px height over a fractional density gives a fractional inset.
      const ANDROID_INSET = 24.6;
      let os: jest.ReplaceProperty<typeof Platform.OS>;

      beforeEach(() => {
        os = jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
      });

      afterEach(() => os.restore());

      it("fades its own top edge, ending above content at the inset", async () => {
        await renderUnder(ANDROID_INSET);

        expect(screen.queryByTestId(SKY_PART.STATUS_BAR_MASK)).toBeNull();
        expect(screen.getByTestId(SCROLL)).toHaveProp("fadingEdgeLength", { start: 24, end: 0 });
      });
    });
  });
});
