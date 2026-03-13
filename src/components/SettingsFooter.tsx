import { useRef, useCallback } from "react";
import * as Application from "expo-application";
import Constants from "expo-constants";

// Components
import CrashLogButton from "@/components/CrashLogButton";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { useHaptic } from "@/hooks/useHaptic";
import { useDebugModeStore } from "@/stores/debugMode";

const SECRET_TAP_COUNT = 7;
const TAP_TIMEOUT_MS = 3000;

const SettingsFooter = () => {
  const appVersion =
    Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0";

  const buildNumber =
    Application.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || "1";

  const isDebugEnabled = useDebugModeStore((s) => s.isEnabled);
  const toggleDebugMode = useDebugModeStore((s) => s.toggle);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const hapticSuccess = useHaptic("success");

  const handleVersionTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current > TAP_TIMEOUT_MS) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;

    if (tapCountRef.current >= SECRET_TAP_COUNT) {
      tapCountRef.current = 0;
      hapticSuccess();
      toggleDebugMode();
    }
  }, [hapticSuccess, toggleDebugMode]);

  return (
    <Box alignItems="center" justifyContent="center" paddingVertical="$8" marginTop="auto">
      <Pressable onPress={handleVersionTap}>
        <Text size="md" color="$typographySecondary" textAlign="center" marginBottom="$2">
          {appVersion} ({buildNumber}){isDebugEnabled ? " 🔧" : ""}
        </Text>
      </Pressable>

      <CrashLogButton />
    </Box>
  );
};

export default SettingsFooter;
