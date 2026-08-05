import { useEffect, useState } from "react";
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { useToastStore } from "@/stores/toast";
import { AccessibilityInfo, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useRTL } from "@/contexts/RTLContext";
import { PlatformType } from "@/enums/app";

export function ToastProvider() {
  const { message, title, type, isVisible } = useToastStore();
  const insets = useSafeAreaInsets();
  const { isRTL } = useRTL();

  // The toast text is Tamagui's, not the app's Text wrapper, so direction is
  // applied here. iOS resolves natural alignment from the app's UI direction,
  // which forceRTL leaves stale until the next launch.
  const textAlign = isRTL ? "right" : "left";
  const writingDirection =
    Platform.OS === PlatformType.IOS && isRTL ? ({ writingDirection: "rtl" } as const) : undefined;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.duration(200)}
      style={{
        position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
        top: insets.top + 10,
        left: 10,
        right: 10,
        zIndex: 50,
      }}>
      <Toast action={type}>
        {title && (
          <ToastTitle textAlign={textAlign} style={writingDirection}>
            {title}
          </ToastTitle>
        )}
        <ToastDescription textAlign={textAlign} style={writingDirection}>
          {message}
        </ToastDescription>
      </Toast>
    </Animated.View>
  );
}
