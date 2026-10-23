import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { act, screen, within } from "@testing-library/react-native";
import { Easing, ReduceMotion, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import { ACTIONSHEET_PART, Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { ELEVATION } from "@/constants/Elevation";
import { SHEET_CURVE, SHEET_MOTION, SPRING } from "@/constants/Motion";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { BOTTOM_SHEET_PART, dismissConfigs, modalProps } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const BLUR_VIEW = "blur-view";
jest.mock("expo-blur", () => {
  const { createElement, forwardRef: wrap } = jest.requireActual("react");
  const { View: NativeView } = jest.requireActual("react-native");
  return {
    BlurView: (props: object) => createElement(NativeView, { testID: "blur-view", ...props }),
    BlurTargetView: wrap((props: object, ref: unknown) =>
      createElement(NativeView, { ref, ...props })
    ),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: jest.fn(),
}));
const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const BODY = "body";
const hidden = { includeHiddenElements: true };

const Sheet = ({ open, fitContent }: { open: boolean; fitContent?: boolean }) => (
  <Actionsheet isOpen={open} fitContent={fitContent}>
    <ActionsheetContent>
      <View testID={BODY} />
    </ActionsheetContent>
  </Actionsheet>
);

const sheetProps = () => modalProps.mock.lastCall?.[0];
const styleOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style);

const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  Object.defineProperty(Platform, "Version", { configurable: true, get: () => version });
};

beforeEach(() => {
  mockReduced = false;
  jest.mocked(useSafeAreaInsets).mockReturnValue(INSETS);
  modalProps.mockClear();
  dismissConfigs.mockClear();
  jest.mocked(withTiming).mockClear();
});

afterEach(() => setPlatform(originalOS, originalVersion));

describe("Actionsheet surface", () => {
  it("lifts the sheet with the e3 shadow pair", async () => {
    await renderWithTheme(<Sheet open />);

    expect(sheetProps()?.backgroundStyle?.boxShadow).toBe(ELEVATION.e3.boxShadow.light);
  });

  // gorhom applies its own default radius when none is set.
  it("rounds the sheet's top corners at $sheet", async () => {
    await renderWithTheme(<Sheet open />);

    expect(sheetProps()?.backgroundStyle).toMatchObject({
      borderTopLeftRadius: getTokenValue("$sheet", "radius"),
      borderTopRightRadius: getTokenValue("$sheet", "radius"),
    });
  });

  it("fills the sheet body with the raised colour", async () => {
    await renderWithTheme(<Sheet open />);

    expect(sheetProps()?.backgroundStyle?.backgroundColor).toBe(NEDAA_LIGHT.raised.hex);
  });

  // A tall sheet stops this far below the status bar.
  it("keeps a content-sized sheet the $5 step below the status bar", async () => {
    await renderWithTheme(<Sheet open fitContent />);

    expect(sheetProps()?.topInset).toBe(INSETS.top + getTokenValue("$5", "space"));
  });
});

describe("Actionsheet header", () => {
  // The handle's pan drags the sheet wherever its content is scrolled.
  it("keeps gorhom's handle, its pan gesture on", async () => {
    await renderWithTheme(<Sheet open />);

    expect(sheetProps()?.handleComponent).toEqual(expect.any(Function));
    expect(sheetProps()?.enableHandlePanningGesture ?? true).toBe(true);
  });

  it("draws the handle as the blurred header", async () => {
    await renderWithTheme(<Sheet open />);

    const header = screen.getByTestId(ACTIONSHEET_PART.HEADER, hidden);
    expect(within(header).getByTestId(BLUR_VIEW, hidden)).toBeTruthy();
    expect(within(header).getByTestId(ACTIONSHEET_PART.GRABBER, hidden)).toBeTruthy();
  });

  // The header takes no room of its own; the content starts under it.
  it("lays the header over the content, which starts at its foot", async () => {
    await renderWithTheme(<Sheet open />);
    const header = styleOf(ACTIONSHEET_PART.HEADER);

    expect(header.marginBottom).toBe(-header.height);
    expect(styleOf(ACTIONSHEET_PART.BODY).paddingTop).toBe(header.height);
  });

  it("draws a 36 by 5 grabber, round at the ends", async () => {
    await renderWithTheme(<Sheet open />);

    expect(styleOf(ACTIONSHEET_PART.GRABBER)).toMatchObject({
      width: getTokenValue("$9", "size"),
      height: 5,
      borderTopLeftRadius: getTokenValue("$pill", "radius"),
      backgroundColor: NEDAA_LIGHT.handle.hex,
    });
  });

  it("sets the grabber 8 below the top and 14 above the content", async () => {
    await renderWithTheme(<Sheet open />);

    expect(styleOf(ACTIONSHEET_PART.HEADER)).toMatchObject({
      paddingTop: getTokenValue("$2", "space"),
      paddingBottom: getTokenValue("$3.5", "space"),
    });
  });

  it("hides the grabber from a screen reader", async () => {
    await renderWithTheme(<Sheet open />);

    expect(screen.queryByTestId(ACTIONSHEET_PART.GRABBER)).toBeNull();
  });
});

describe("Actionsheet on Android", () => {
  // Android blurs only the view it is handed: the sheet's own content.
  it("hands the header blur the content as its target", async () => {
    setPlatform("android", 34);
    await renderWithTheme(<Sheet open />);

    const target = screen.getByTestId(ACTIONSHEET_PART.BODY, hidden);
    expect(within(target).getByTestId(BODY, hidden)).toBeTruthy();
    expect(within(target).queryByTestId(ACTIONSHEET_PART.HEADER, hidden)).toBeNull();
    expect(screen.getByTestId(BLUR_VIEW, hidden).props.blurTarget).toBeTruthy();
  });

  it("draws no blur below Android 12", async () => {
    setPlatform("android", 30);
    await renderWithTheme(<Sheet open />);

    expect(screen.queryByTestId(BLUR_VIEW, hidden)).toBeNull();
  });
});

describe("Actionsheet motion", () => {
  it("settles into place on the settle spring", async () => {
    await renderWithTheme(<Sheet open />);

    expect(sheetProps()?.animationConfigs).toEqual(SPRING.SETTLE);
    expect(sheetProps()?.overrideReduceMotion).toBe(ReduceMotion.Never);
  });

  it("leaves on the system sheet curve", async () => {
    await renderWithTheme(<Sheet open />);

    await screen.rerender(<Sheet open={false} />);

    expect(dismissConfigs).toHaveBeenLastCalledWith({
      duration: SHEET_MOTION.DISMISS_MS,
      easing: Easing.bezier(...SHEET_CURVE),
    });
  });

  it("leaves on the system sheet curve on Android's back gesture", async () => {
    const listen = jest.spyOn(BackHandler, "addEventListener");
    await renderWithTheme(<Sheet open />);

    await act(() => listen.mock.lastCall?.[1]({ type: "hardwareBackPress", timeStamp: 0 }));

    expect(dismissConfigs).toHaveBeenLastCalledWith({
      duration: SHEET_MOTION.DISMISS_MS,
      easing: Easing.bezier(...SHEET_CURVE),
    });
  });

  describe("under Reduce Motion", () => {
    beforeEach(() => {
      mockReduced = true;
    });

    it("fades the sheet in where it stands", async () => {
      await renderWithTheme(<Sheet open />);

      expect(sheetProps()?.overrideReduceMotion).toBe(ReduceMotion.Always);
      expect(withTiming).toHaveBeenCalledWith(1, { duration: SHEET_MOTION.REDUCED_FADE_MS });
      expect(styleOf(ACTIONSHEET_PART.LAYER).opacity).toBe(1);
    });

    it("fades the sheet out before it goes", async () => {
      jest.useFakeTimers();
      await renderWithTheme(<Sheet open />);

      await screen.rerender(<Sheet open={false} />);

      expect(withTiming).toHaveBeenLastCalledWith(0, { duration: SHEET_MOTION.REDUCED_FADE_MS });
      expect(screen.getByTestId(BOTTOM_SHEET_PART.CONTENT, hidden)).toBeTruthy();
      await act(() => jest.advanceTimersByTime(SHEET_MOTION.REDUCED_FADE_MS));
      expect(screen.queryByTestId(BOTTOM_SHEET_PART.CONTENT, hidden)).toBeNull();
      jest.useRealTimers();
    });
  });
});
