import { type ReactNode } from "react";
import { View } from "react-native";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useScreenshotStore } from "@/stores/screenshotStore";

export function ScreenshotModeWrapper({ children }: { children: ReactNode }) {
  if (!IS_SCREENSHOT_MODE) return <>{children}</>;
  return <ScreenshotModeWrapperInner>{children}</ScreenshotModeWrapperInner>;
}

function ScreenshotModeWrapperInner({ children }: { children: ReactNode }) {
  const screen = useScreenshotStore((s) => s.screen);
  return (
    <>
      {children}
      {screen !== null ? (
        <View
          testID="screenshot-ready"
          accessibilityLabel="screenshot-ready"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0.01 }}
        />
      ) : null}
    </>
  );
}
