import { type ReactNode } from "react";
import { View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { E2E_ID, screenshotReadyId } from "@/constants/E2E";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useAppStore } from "@/stores/app";
import { useScreenshotStore } from "@/stores/screenshotStore";

export function ScreenshotModeWrapper({ children }: { children: ReactNode }) {
  if (!IS_SCREENSHOT_MODE) return <>{children}</>;
  return <ScreenshotModeWrapperInner>{children}</ScreenshotModeWrapperInner>;
}

// Draws nothing; opaque and 4pt so Android reports it visible to Maestro.
const MARKER_STYLE = { position: "absolute", top: "50%", left: 0, width: 4, height: 4 } as const;

// Behind the app, below the status bar: a crop to it drops the system icons.
const FRAME_STYLE = {
  position: "absolute",
  top: initialWindowMetrics?.insets.top ?? 0,
  bottom: 0,
  left: 0,
  right: 0,
} as const;

/** A view the capture flows find by id; unflattened so Android reports it. */
const Probe = ({ id, style }: { id: string; style: typeof MARKER_STYLE | typeof FRAME_STYLE }) => (
  <View
    testID={id}
    accessibilityLabel={id}
    collapsable={false}
    pointerEvents="none"
    style={style}
  />
);

function ScreenshotModeWrapperInner({ children }: { children: ReactNode }) {
  const screen = useScreenshotStore((s) => s.screen);
  const locale = useScreenshotStore((s) => s.locale);
  const loading = useAppStore((s) => s.showLoadingOverlay);
  return (
    <>
      <Probe id={E2E_ID.SCREENSHOT_FRAME} style={FRAME_STYLE} />
      {children}
      {screen !== null && !loading ? (
        <>
          <Probe id={E2E_ID.SCREENSHOT_READY} style={MARKER_STYLE} />
          <Probe id={screenshotReadyId(screen, locale)} style={MARKER_STYLE} />
        </>
      ) : null}
    </>
  );
}
