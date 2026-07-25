import { useState } from "react";
import { Alert, Pressable } from "react-native";
import { XStack } from "tamagui";
import { RotateCcw } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useDebugModeStore } from "@/stores/debugMode";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { Section } from "@/components/quran/settings/SettingsControls";

interface MaintenanceSectionProps {
  chrome: QuranChromeColors;
  onResetAll: () => Promise<void>;
}

// Testing aid behind the 7-tap debug flag: wipes downloaded editions and
// content, returning the reader to setup.
const MaintenanceSection = ({ chrome, onResetAll }: MaintenanceSectionProps) => {
  const isDebugMode = useDebugModeStore((s) => s.isEnabled);
  const [resetting, setResetting] = useState(false);

  const handleResetAll = () => {
    Alert.alert(
      "Reset all Quran data?",
      "Deletes downloaded editions and content. You'll return to setup.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await onResetAll();
              // onResetAll closes the sheet, so no success state to clear here.
            } catch (e) {
              setResetting(false);
              Alert.alert("Reset failed", String(e));
            }
          },
        },
      ]
    );
  };

  if (!isDebugMode) return null;

  return (
    <Section title="Maintenance" chrome={chrome}>
      <Pressable
        onPress={handleResetAll}
        disabled={resetting}
        accessibilityRole="button"
        accessibilityLabel="Reset all Quran data"
        accessibilityState={{ disabled: resetting }}>
        <XStack alignItems="center" gap="$2" minHeight={44} paddingHorizontal="$3">
          <RotateCcw size={16} color={chrome.accentWarning} />
          <Text fontSize={15} color={chrome.accentWarning} fontWeight="600">
            {resetting ? "Resetting…" : "Reset all Quran data (testing)"}
          </Text>
        </XStack>
      </Pressable>
    </Section>
  );
};

export default MaintenanceSection;
