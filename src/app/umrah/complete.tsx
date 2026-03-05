import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Button } from "@/components/ui/button";
import CompletionSummary from "@/components/umrah/CompletionSummary";

import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";
import type { UmrahRecord } from "@/types/umrah";

export default function CompleteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const successHaptic = useHaptic("success");
  const { completeUmrah, startUmrah } = useUmrahGuideStore();
  const [record, setRecord] = useState<UmrahRecord | null>(null);

  useEffect(() => {
    const complete = async () => {
      const result = await completeUmrah();
      setRecord(result);
      await successHaptic();
      // Double pulse
      setTimeout(() => successHaptic(), 300);
    };
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDone = () => {
    router.replace("/(tabs)/tools");
  };

  const handleStartNew = () => {
    startUmrah();
    router.replace("/umrah");
  };

  const handleBackToHome = () => {
    router.replace("/(tabs)/");
  };

  if (!record) {
    return (
      <Background>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text color="$typographySecondary">{t("umrah.complete.title")}</Text>
        </Box>
      </Background>
    );
  }

  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        <Box flex={1} justifyContent="center" paddingTop="$8">
          <CompletionSummary record={record} />
        </Box>

        <VStack gap="$3" paddingHorizontal="$4" paddingTop="$6">
          <Button
            size="lg"
            onPress={handleDone}
            accessibilityRole="button"
            accessibilityLabel={t("umrah.complete.done")}>
            <Button.Text>{t("umrah.complete.done")}</Button.Text>
          </Button>

          <Button
            size="lg"
            variant="outline"
            onPress={handleStartNew}
            accessibilityRole="button"
            accessibilityLabel={t("umrah.complete.startNew")}>
            <Button.Text>{t("umrah.complete.startNew")}</Button.Text>
          </Button>

          <Button
            size="lg"
            variant="link"
            onPress={handleBackToHome}
            accessibilityRole="button"
            accessibilityLabel={t("umrah.complete.backToHome")}>
            <Button.Text>{t("umrah.complete.backToHome")}</Button.Text>
          </Button>
        </VStack>
      </ScrollView>
    </Background>
  );
}
