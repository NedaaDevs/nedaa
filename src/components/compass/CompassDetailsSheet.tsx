import { RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Sheet } from "tamagui";

import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type DetailRowProps = {
  label: string;
  value: string;
};

const DetailRow = ({ label, value }: DetailRowProps) => (
  <HStack justifyContent="space-between" alignItems="center" gap="$3" minHeight={44}>
    <Text size="sm" color="$typographySecondary">
      {label}
    </Text>
    <Text size="sm" color="$typography" textAlign="right" flexShrink={1}>
      {value}
    </Text>
  </HStack>
);

type CompassDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headingText: string;
  qiblaText: string | null;
  distanceText: string | null;
  sensorAccuracyText: string;
  sensorReliabilityText: string;
  northReferenceText: string;
  locationText: string | null;
  isRefreshing: boolean;
  canRefreshLocation: boolean;
  onRefreshLocation: () => void;
};

export const CompassDetailsSheet = ({
  open,
  onOpenChange,
  headingText,
  qiblaText,
  distanceText,
  sensorAccuracyText,
  sensorReliabilityText,
  northReferenceText,
  locationText,
  isRefreshing,
  canRefreshLocation,
  onRefreshLocation,
}: CompassDetailsSheetProps) => {
  const { t } = useTranslation();

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPointsMode="fit" dismissOnSnapToBottom>
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame padding="$5" paddingBottom="$8">
        <VStack gap="$3">
          <Text size="lg" bold accessibilityRole="header">
            {t("compass.details.title")}
          </Text>

          <DetailRow label={t("compass.details.heading")} value={headingText} />
          {qiblaText !== null && <DetailRow label={t("compass.details.qibla")} value={qiblaText} />}
          {distanceText !== null && (
            <DetailRow label={t("compass.details.distance")} value={distanceText} />
          )}
          <DetailRow
            label={t("compass.details.sensorAccuracy")}
            value={`${sensorAccuracyText} · ${sensorReliabilityText}`}
          />
          <DetailRow label={t("compass.details.northReference")} value={northReferenceText} />
          {locationText !== null && (
            <DetailRow label={t("compass.details.location")} value={locationText} />
          )}

          {canRefreshLocation && (
            <Button
              size="md"
              disabled={isRefreshing}
              onPress={onRefreshLocation}
              accessibilityRole="button"
              accessibilityLabel={t("compass.details.refreshLocation")}
              accessibilityState={{ disabled: isRefreshing }}>
              {isRefreshing ? <Button.Spinner /> : <Button.Icon as={RefreshCw} />}
              <Button.Text>{t("compass.details.refreshLocation")}</Button.Text>
            </Button>
          )}

          <Text size="xs" color="$typographySecondary" textAlign="center">
            {t("compass.disclaimer")}
          </Text>
        </VStack>
      </Sheet.Frame>
    </Sheet>
  );
};
