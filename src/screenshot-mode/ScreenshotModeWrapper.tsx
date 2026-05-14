import { useEffect } from "react";
import { View } from "react-native";
import { Easing } from "react-native-reanimated";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useScreenshotStore } from "@/stores/screenshotStore";

export function ScreenshotModeWrapper({ children }: { children: React.ReactNode }) {
  if (!IS_SCREENSHOT_MODE) return <>{children}</>;
  return <ScreenshotModeWrapperInner>{children}</ScreenshotModeWrapperInner>;
}

function ScreenshotModeWrapperInner({ children }: { children: React.ReactNode }) {
  const screen = useScreenshotStore((s) => s.screen);
  useEffect(() => {
    void Easing.linear; // referenced to assert the import resolves
  }, []);
  return (
    <>
      {children}
      {screen !== null ? (
        <View
          testID="screenshot-ready"
          accessibilityLabel="screenshot-ready"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
        />
      ) : null}
    </>
  );
}
