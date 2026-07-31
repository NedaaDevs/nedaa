import { useState, useCallback, useEffect } from "react";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";

import {
  getPlacedWidgetCount,
  getWidgetLastRenderedAt,
  isWidgetRefreshAvailable,
  triggerWidgetReload,
} from "@/services/widgetBridge";

const formatAge = (millis: number): string => {
  if (millis === 0) return "never";
  const seconds = Math.round((Date.now() - millis) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
};

const WidgetsDebugScreen = () => {
  const [heartbeat, setHeartbeat] = useState(0);
  const [placed, setPlaced] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const read = useCallback(async () => {
    setHeartbeat(getWidgetLastRenderedAt());
    try {
      setPlaced(await getPlacedWidgetCount());
      setCountError(null);
    } catch (error) {
      setPlaced(null);
      setCountError(String(error));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds state from a native heartbeat query on mount
    void read();
  }, [read]);

  return (
    <Background>
      <TopBar title="Widgets Debug" backOnClick />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack gap="$3" paddingHorizontal="$4" paddingTop="$6">
          <Card borderRadius="$7" borderWidth={1} borderColor="$outline">
            <VStack gap="$2">
              <HStack justifyContent="space-between">
                <Text size="sm">Native module</Text>
                <Text size="sm" fontWeight="600">
                  {isWidgetRefreshAvailable() ? "available" : "MISSING"}
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text size="sm">Placed widgets</Text>
                <Text size="sm" fontWeight="600">
                  {countError ?? placed ?? "—"}
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text size="sm">Last render</Text>
                <Text size="sm" fontWeight="600">
                  {formatAge(heartbeat)}
                </Text>
              </HStack>
              <Text size="xs" color="$typographySecondary">
                {heartbeat === 0 ? "no heartbeat recorded" : String(heartbeat)}
              </Text>
            </VStack>
          </Card>

          <Button onPress={read} accessibilityRole="button" accessibilityLabel="Re-read heartbeat">
            <Button.Text>Re-read</Button.Text>
          </Button>

          <Button
            onPress={async () => {
              await triggerWidgetReload();
              await read();
            }}
            accessibilityRole="button"
            accessibilityLabel="Trigger widget reload">
            <Button.Text>Trigger reload</Button.Text>
          </Button>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default WidgetsDebugScreen;
