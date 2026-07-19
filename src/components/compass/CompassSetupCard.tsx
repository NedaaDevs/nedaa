import { Compass, LocateFixed, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type CompassSetupCardProps = {
  isRefreshing: boolean;
  onChooseQibla: () => void;
  onChooseCompassOnly: () => void;
};

export const CompassSetupCard = ({
  isRefreshing,
  onChooseQibla,
  onChooseCompassOnly,
}: CompassSetupCardProps) => {
  const { t } = useTranslation();

  return (
    <Card width="100%" maxWidth={420} padding="$6" gap="$5" accessibilityLiveRegion="polite">
      <VStack gap="$2" alignItems="center">
        <Icon as={Compass} size="xl" color="$primary" />
        <Text size="2xl" bold textAlign="center" accessibilityRole="header">
          {t("compass.setup.title")}
        </Text>
        <Text color="$typographySecondary" textAlign="center">
          {t("compass.setup.description")}
        </Text>
      </VStack>

      <VStack gap="$3">
        <Button
          size="lg"
          width="100%"
          disabled={isRefreshing}
          onPress={onChooseQibla}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.compass.usePrecise")}
          accessibilityHint={t("a11y.compass.usePreciseHint")}
          accessibilityState={{ disabled: isRefreshing }}>
          {isRefreshing ? <Button.Spinner /> : <Button.Icon as={LocateFixed} />}
          <Button.Text>{t("compass.action.usePrecise")}</Button.Text>
        </Button>

        <VStack gap="$2">
          <Button
            size="lg"
            width="100%"
            variant="outline"
            onPress={onChooseCompassOnly}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.compass.chooseCompassOnly")}
            accessibilityHint={t("a11y.compass.chooseCompassOnlyHint")}>
            <Button.Icon as={Compass} />
            <Button.Text>{t("compass.action.compassOnly")}</Button.Text>
          </Button>
          <Text size="xs" color="$typographySecondary" textAlign="center">
            {t("compass.setup.locationFree")}
          </Text>
        </VStack>
      </VStack>

      <HStack gap="$2" alignItems="center" justifyContent="center">
        <Icon as={ShieldCheck} size="sm" color="$success" />
        <Text size="xs" color="$typographySecondary">
          {t("compass.setup.private")}
        </Text>
      </HStack>
    </Card>
  );
};
