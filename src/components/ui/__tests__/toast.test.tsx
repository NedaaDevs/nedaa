import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { fireEvent, screen, userEvent } from "@testing-library/react-native";

import { Toast, TOAST_A11Y_ACTION, TOAST_PART } from "@/components/ui/toast";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { getTokenValue } from "tamagui";
import { TOAST_KIND } from "@/constants/Toast";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const BLUR_VIEW = "blur-view";
jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BlurView: (props: object) => createElement(View, { testID: "blur-view", ...props }) };
});

const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  Object.defineProperty(Platform, "Version", { configurable: true, get: () => version });
};

const MESSAGE = "Couldn't update prayer times.";

describe("Toast surface", () => {
  afterEach(() => setPlatform(originalOS, originalVersion));

  const frame = () => StyleSheet.flatten(screen.getByTestId(TOAST_PART.FRAME).props.style);

  it("floats on the blurred float material, lifted by e2", async () => {
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={jest.fn()} />
    );

    expect(screen.getByTestId(BLUR_VIEW)).toBeTruthy();
    expect(frame().backgroundColor).toBe(NEDAA_LIGHT.surfaceFloat.hex);
    expect(frame().boxShadow).toBe(ELEVATION.e2.boxShadow.light);
    expect(frame().borderTopWidth ?? 0).toBe(0);
  });

  // Blurring the screen behind would mean wrapping every screen in a target.
  it("keeps the opaque float colour on Android", async () => {
    setPlatform("android", 34);
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={jest.fn()} />
    );

    expect(screen.queryByTestId(BLUR_VIEW)).toBeNull();
    expect(frame().backgroundColor).toBe(`${NEDAA_LIGHT.surfaceFloat.hex.slice(0, 7)}FF`);
  });
});

describe("Toast", () => {
  it.each(Object.values(TOAST_KIND))(
    "reads a %s toast as its kind, then the message",
    async (kind) => {
      await renderWithTheme(<Toast kind={kind} message={MESSAGE} onDismiss={jest.fn()} />);

      expect(screen.getByLabelText(`${i18n.t(`a11y.toast.${kind}`)}: ${MESSAGE}`)).toBeTruthy();
    }
  );

  it("keeps its icon from the screen reader", async () => {
    await renderWithTheme(
      <Toast kind={TOAST_KIND.ERROR} message={MESSAGE} onDismiss={jest.fn()} />
    );

    expect(screen.queryByTestId(TOAST_PART.ICON)).toBeNull();
  });

  it("never cuts the message short", async () => {
    await renderWithTheme(
      <Toast kind={TOAST_KIND.ERROR} message={MESSAGE} onDismiss={jest.fn()} />
    );

    expect(screen.getByText(MESSAGE).props.numberOfLines).toBeUndefined();
  });

  it("offers one action as a 44pt button that redoes the operation", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Toast
        kind={TOAST_KIND.ERROR}
        message={MESSAGE}
        action={{ label: "Retry", onPress }}
        onDismiss={jest.fn()}
      />
    );

    await userEvent.press(screen.getByRole("button", { name: "Retry" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(controlProblems()).toEqual([]);
  });

  // A 34pt tile on chip corners, washed at .14 of its kind.
  it("sets its glyph on a 34pt chip tile tinted at .14", async () => {
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={jest.fn()} />
    );
    const icon = screen.getByTestId(TOAST_PART.ICON, { includeHiddenElements: true });
    const tint = screen.getByTestId(TOAST_PART.TINT, { includeHiddenElements: true });

    expect(StyleSheet.flatten(icon.props.style)).toMatchObject({ width: 34, height: 34 });
    const chip = getTokenValue("$chip", "radius");

    expect(StyleSheet.flatten(tint.props.style)).toMatchObject({
      borderTopLeftRadius: chip,
      borderBottomRightRadius: chip,
      opacity: 0.14,
    });
  });

  it("sets the message at 14/600", async () => {
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={jest.fn()} />
    );

    expect(StyleSheet.flatten(screen.getByText(MESSAGE).props.style)).toMatchObject({
      fontSize: 14,
    });
  });

  it.each(Object.values(TOAST_KIND))(
    "draws a %s toast's action as an accent text button at 14",
    async (kind) => {
      await renderWithTheme(
        <Toast
          kind={kind}
          message={MESSAGE}
          action={{ label: "Retry", onPress: jest.fn() }}
          onDismiss={jest.fn()}
        />
      );
      const button = screen.getByRole("button", { name: "Retry" });

      expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe("transparent");
      expect(StyleSheet.flatten(screen.getByText("Retry").props.style)).toMatchObject({
        fontSize: 14,
        color: NEDAA_LIGHT.accentText.hex,
      });
    }
  );

  it("lets a screen reader dismiss it", async () => {
    const onDismiss = jest.fn();
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={onDismiss} />
    );
    const body = screen.getByLabelText(`${i18n.t("a11y.toast.success")}: ${MESSAGE}`);

    expect(body.props.accessibilityActions).toEqual([
      { name: TOAST_A11Y_ACTION.DISMISS, label: i18n.t("a11y.toast.dismiss") },
    ]);
    fireEvent(body, "accessibilityAction", {
      nativeEvent: { actionName: TOAST_A11Y_ACTION.DISMISS },
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does nothing when its body is tapped", async () => {
    const onDismiss = jest.fn();
    await renderWithTheme(
      <Toast kind={TOAST_KIND.SUCCESS} message={MESSAGE} onDismiss={onDismiss} />
    );

    expect(controlProblems()).toEqual([]);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(AccessibilityInfo.announceForAccessibilityWithOptions).not.toHaveBeenCalled();
  });
});
