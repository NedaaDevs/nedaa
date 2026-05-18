import { type ReactNode } from "react";
import { View } from "react-native";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useScreenshotStore } from "@/stores/screenshotStore";

export function ScreenshotModeWrapper({ children }: { children: ReactNode }) {
  if (!IS_SCREENSHOT_MODE) return <>{children}</>;
  return <ScreenshotModeWrapperInner>{children}</ScreenshotModeWrapperInner>;
}

const MARKER_STYLE = { position: "absolute", width: 1, height: 1, opacity: 0.01 } as const;

function ScreenshotModeWrapperInner({ children }: { children: ReactNode }) {
  const screen = useScreenshotStore((s) => s.screen);
  const locale = useScreenshotStore((s) => s.locale);
  return (
    <>
      {children}
      {screen !== null ? (
        <>
          <View
            testID="screenshot-ready"
            accessibilityLabel="screenshot-ready"
            style={MARKER_STYLE}
          />
          <View
            testID={`shot-ready-${screen}-${locale}`}
            accessibilityLabel={`shot-ready-${screen}-${locale}`}
            style={MARKER_STYLE}
          />
        </>
      ) : null}
    </>
  );
}
