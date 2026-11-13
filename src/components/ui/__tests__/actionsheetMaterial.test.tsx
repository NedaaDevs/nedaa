import { BackHandler, Dimensions, Platform, StyleSheet, View } from "react-native";
import { act, screen, userEvent, within } from "@testing-library/react-native";
import { normalizeSnapPoint } from "@gorhom/bottom-sheet/src/utilities/normalizeSnapPoint";
import { Easing, ReduceMotion, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import {
  ACTIONSHEET_PART,
  Actionsheet,
  ActionsheetContent,
  ActionsheetHero,
  CLOSED_INDEX,
} from "@/components/ui/actionsheet";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { ELEVATION } from "@/constants/Elevation";
import { SHEET_CURVE, SHEET_MOTION, SPRING } from "@/constants/Motion";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { SHEET_CHROME_PART } from "@/constants/SheetChrome";
import {
  BOTTOM_SHEET_PART,
  dismissConfigs,
  modalProps,
  moveSheet,
} from "@/test-helpers/bottomSheetMock";
import { clearHaptics, firedHaptics } from "@/test-helpers/hapticMock";
import { DYNAMIC_ISLAND_INSETS } from "@/test-helpers/safeAreaInsets";
import { renderWithTheme } from "@/test-helpers/theme";
import i18n from "@/localization/i18n";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

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

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const BODY = "body";
const hidden = { includeHiddenElements: true };
// A hand catches a close this far below the detent it left.
const PARTWAY_DOWN = -0.4;
const TWO_DETENTS = [50, 90];

type SheetProps = { open: boolean; fitContent?: boolean; snapPoints?: number[] };

const Sheet = ({ open, fitContent, snapPoints }: SheetProps) => (
  <Actionsheet isOpen={open} fitContent={fitContent} snapPoints={snapPoints}>
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
  jest.mocked(useSafeAreaInsets).mockReturnValue(DYNAMIC_ISLAND_INSETS);
  modalProps.mockClear();
  dismissConfigs.mockClear();
  jest.mocked(withTiming).mockClear();
  clearHaptics();
});

afterEach(() => setPlatform(originalOS, originalVersion));

describe("Actionsheet surface", () => {
  it("sets the body in the screen gutter at its sides", async () => {
    await renderWithTheme(<Sheet open />);
    const gutter = getTokenValue("$screen", "space");

    expect(styleOf(ACTIONSHEET_PART.BODY)).toMatchObject({ paddingHorizontal: gutter });
  });

  it("lifts the sheet with the e3 shadow pair", async () => {
    await renderWithTheme(<Sheet open />);

    expect(styleOf(SHEET_CHROME_PART.BACKGROUND).boxShadow).toBe(ELEVATION.e3.boxShadow.light);
  });

  it("rounds the sheet at $sheet", async () => {
    await renderWithTheme(<Sheet open />);

    expect(styleOf(SHEET_CHROME_PART.BACKGROUND)).toMatchObject({
      borderRadius: getTokenValue("$sheet", "radius"),
    });
  });

  it("fills the sheet body with the raised colour", async () => {
    await renderWithTheme(<Sheet open />);

    expect(styleOf(SHEET_CHROME_PART.BACKGROUND).backgroundColor).toBe(NEDAA_LIGHT.raised.hex);
  });

  it.each([
    ["its content", { fitContent: true }],
    ["detents", { snapPoints: TWO_DETENTS }],
  ])("keeps a sheet sized by %s the $5 step below the status bar", async (_, size) => {
    await renderWithTheme(<Sheet open {...size} />);

    expect(sheetProps()?.topInset).toBe(DYNAMIC_ISLAND_INSETS.top + getTokenValue("$5", "space"));
  });

  // gorhom measures a detent below the top inset; the sheet's top stays put.
  it.each(TWO_DETENTS)("keeps a %s%% detent that share of the screen tall", async (percent) => {
    await renderWithTheme(<Sheet open snapPoints={[percent]} />);

    const topInset = sheetProps()?.topInset ?? 0;
    const [detent] = sheetProps()?.snapPoints ?? [];
    const screenHeight = Dimensions.get("window").height;
    const top = topInset + normalizeSnapPoint(detent, screenHeight - topInset);

    expect(top).toBeCloseTo(screenHeight * (1 - percent / 100));
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

  // A snap point is a commit; arriving on open is not.
  it("taps lightly when it reaches a snap point, not when it opens", async () => {
    await renderWithTheme(<Sheet open />);

    expect(firedHaptics()).toEqual([]);
    await act(() => sheetProps()?.onChange?.(1));

    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.LIGHT]);
  });

  it("fades the scrim in on its own 220 timing", async () => {
    await renderWithTheme(<Sheet open />);

    expect(withTiming).toHaveBeenCalledWith(1, { duration: SHEET_MOTION.SCRIM_MS });
    expect(SHEET_MOTION.SCRIM_MS).toBe(220);
    expect(styleOf(ACTIONSHEET_PART.SCRIM).opacity).toBe(1);
  });

  // However it leaves, the scrim fades on its own timing.
  it("fades the scrim out on its 220 timing once the sheet starts to leave", async () => {
    await renderWithTheme(<Sheet open />);
    jest.mocked(withTiming).mockClear();

    await act(() => sheetProps()?.onAnimate?.(0, CLOSED_INDEX));

    expect(withTiming).toHaveBeenCalledWith(0, { duration: SHEET_MOTION.SCRIM_MS });
    expect(styleOf(ACTIONSHEET_PART.SCRIM).opacity).toBe(0);
  });

  // gorhom reports nothing when a caught close springs back to its detent.
  it("dims the screen again once a caught close climbs back to its detent", async () => {
    await renderWithTheme(<Sheet open />);
    await act(() => moveSheet(0));

    await act(() => sheetProps()?.onAnimate?.(0, CLOSED_INDEX));
    await act(() => moveSheet(PARTWAY_DOWN));
    await act(() => moveSheet(0));

    expect(styleOf(ACTIONSHEET_PART.SCRIM).opacity).toBe(1);
  });

  it("dims the screen again once a caught close settles on another detent", async () => {
    await renderWithTheme(<Sheet open snapPoints={TWO_DETENTS} />);

    await act(() => sheetProps()?.onAnimate?.(0, CLOSED_INDEX));
    await act(() => sheetProps()?.onAnimate?.(0, 1));

    expect(styleOf(ACTIONSHEET_PART.SCRIM).opacity).toBe(1);
  });

  it("leaves on the system sheet curve from a tap on the scrim", async () => {
    await renderWithTheme(<Sheet open />);

    await userEvent.press(screen.getByRole("button", { name: i18n.t("a11y.dismiss") }));

    expect(dismissConfigs).toHaveBeenLastCalledWith({
      duration: SHEET_MOTION.DISMISS_MS,
      easing: Easing.bezier(...SHEET_CURVE),
    });
  });

  it("fades the hero in over 120 as the sheet starts", async () => {
    await renderWithTheme(
      <Actionsheet isOpen>
        <ActionsheetContent>
          <ActionsheetHero>
            <View />
          </ActionsheetHero>
        </ActionsheetContent>
      </Actionsheet>
    );

    expect(withTiming).toHaveBeenCalledWith(1, { duration: SHEET_MOTION.HERO_FADE_MS });
    expect(SHEET_MOTION.HERO_FADE_MS).toBe(120);
    expect(styleOf(ACTIONSHEET_PART.HERO).opacity).toBe(1);
  });

  describe("under Reduce Motion", () => {
    beforeEach(() => {
      mockReduced = true;
    });

    it("shows the hero at once", async () => {
      await renderWithTheme(
        <Actionsheet isOpen>
          <ActionsheetContent>
            <ActionsheetHero>
              <View />
            </ActionsheetHero>
          </ActionsheetContent>
        </Actionsheet>
      );

      expect(withTiming).not.toHaveBeenCalledWith(1, { duration: SHEET_MOTION.HERO_FADE_MS });
      expect(styleOf(ACTIONSHEET_PART.HERO).opacity).toBe(1);
    });

    it("keeps the snap point's haptic", async () => {
      await renderWithTheme(<Sheet open />);

      await act(() => sheetProps()?.onChange?.(1));

      expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.LIGHT]);
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
