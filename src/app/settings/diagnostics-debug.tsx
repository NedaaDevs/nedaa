import { ScrollView, Platform } from "react-native";
import { useState } from "react";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";

import { PlatformType } from "@/enums/app";
import { ExpoDiagnosticsModule } from "../../../modules/expo-diagnostics/src";

const triggerJsCrash = () => {
  // Throw outside the handler tick so it reaches the global ErrorUtils handler (which writes
  // the crash sentinel) instead of being swallowed by the press handler.
  setTimeout(() => {
    throw new Error("expo-diagnostics test JS crash");
  }, 0);
};

const DiagnosticsDebugScreen = () => {
  const [armed, setArmed] = useState(false);
  const isIOS = Platform.OS === PlatformType.IOS;

  return (
    <Background>
      <TopBar title="Diagnostics Debug" href="/settings" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} padding="$4" gap="$3">
          <Card padding="$4" backgroundColor="$backgroundMuted">
            <Text size="sm" color="$typographySecondary" lineHeight={20}>
              Triggers kill or freeze the app on purpose. After a crash/ANR, relaunch — it lands in
              the crash log and shows the report prompt. iOS native crash/hang need a
              TestFlight/release build (MetricKit does not deliver on Simulator) and surface on the
              launch after next.
            </Text>
          </Card>

          <Card padding="$4">
            <VStack gap="$3">
              <Text size="md" fontWeight="600" color="$typography">
                {armed ? "Tap a trigger" : "Arm to enable triggers"}
              </Text>

              <Button
                variant={armed ? "outline" : "solid"}
                onPress={() => setArmed((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={armed ? "Disarm crash triggers" : "Arm crash triggers"}>
                <Button.Text>{armed ? "Disarm" : "Arm"}</Button.Text>
              </Button>

              <Button
                disabled={!armed}
                onPress={triggerJsCrash}
                accessibilityRole="button"
                accessibilityLabel="Trigger a JavaScript crash">
                <Button.Text>JS crash</Button.Text>
              </Button>

              <Button
                disabled={!armed}
                onPress={() => ExpoDiagnosticsModule.testNativeCrash()}
                accessibilityRole="button"
                accessibilityLabel="Trigger a native crash">
                <Button.Text>Native crash</Button.Text>
              </Button>

              <Button
                disabled={!armed}
                onPress={() =>
                  isIOS ? ExpoDiagnosticsModule.testHang() : ExpoDiagnosticsModule.testAnr()
                }
                accessibilityRole="button"
                accessibilityLabel={isIOS ? "Trigger a main-thread hang" : "Trigger an ANR"}>
                <Button.Text>{isIOS ? "Hang (main thread)" : "ANR (main thread)"}</Button.Text>
              </Button>
            </VStack>
          </Card>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default DiagnosticsDebugScreen;
