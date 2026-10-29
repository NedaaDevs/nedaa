import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
import { render, screen } from "@testing-library/react-native";

// Fabric's iOS view reads the magic tap flag under this name only.
const NATIVE_FLAG = "onAccessibilityMagicTap";
const VIEW = "magic-tap-view";

/** React Native's own View; the preset mocks it, so its patch is unseen. */
const RealView = jest.requireActual<{ default: ComponentType<ViewProps> }>(
  "react-native/Libraries/Components/View/View"
).default;

/** RCTView's iOS static config, which decides what reaches native. */
const iosViewConfig = jest.requireActual<{
  default: { validAttributes: Record<string, unknown> };
}>("react-native/Libraries/NativeComponent/BaseViewConfig.ios").default;

// RN 0.88 sends `onMagicTap` under its JS name, which iOS Fabric never reads.
describe("the react-native magic tap patch", () => {
  it("lets RCTView's iOS config pass the native flag", () => {
    expect(iosViewConfig.validAttributes[NATIVE_FLAG]).toBe(true);
  });

  it("raises the native flag on a View with a magic tap", async () => {
    await render(<RealView testID={VIEW} onMagicTap={jest.fn()} />);

    expect(screen.getByTestId(VIEW)).toHaveProp(NATIVE_FLAG, true);
  });

  it("leaves the flag off a View without one", async () => {
    await render(<RealView testID={VIEW} />);

    expect(screen.getByTestId(VIEW).props).not.toHaveProperty(NATIVE_FLAG);
  });
});
