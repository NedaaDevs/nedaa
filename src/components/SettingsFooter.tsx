import * as Application from "expo-application";
import Constants from "expo-constants";

// Components
import CrashLogButton from "@/components/CrashLogButton";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";

const SettingsFooter = () => {
  const appVersion =
    Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0";

  const buildNumber =
    Application.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || "1";

  return (
    <Box alignItems="center" justifyContent="center" paddingVertical="$8" marginTop="auto">
      <Text size="md" color="$typographySecondary" textAlign="center" marginBottom="$2">
        {appVersion} ({buildNumber})
      </Text>

      <CrashLogButton />
    </Box>
  );
};

export default SettingsFooter;
