import { AccessibilityInfo } from "react-native";
import { fireEvent, screen, userEvent } from "@testing-library/react-native";

import { Toast, TOAST_A11Y_ACTION, TOAST_PART } from "@/components/ui/toast";
import { TOAST_KIND } from "@/constants/Toast";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const MESSAGE = "Couldn't update prayer times.";

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
