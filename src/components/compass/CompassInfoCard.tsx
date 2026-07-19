import { LocateFixed, MapPinned, RefreshCw, Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type CompassInfoCardProps = {
  isQiblaMode: boolean;
  isSavedLocation: boolean;
  isRefreshing: boolean;
  needsSettings: boolean;
  northReferenceLabel: string;
  sensorAccuracyText: string;
  qiblaDirectionText: string | null;
  qiblaCardinalText: string | null;
  distanceText: string | null;
  locationAccuracyText: string | null;
  fallbackWarningTitle: string | null;
  fallbackWarningBody: string | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

const InfoRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <HStack justifyContent="space-between" alignItems="center" gap="$3">
    <Text color="$typographySecondary" size="sm" flex={1}>
      {label}
    </Text>
    <Text color={emphasis ? "$primary" : "$typography"} fontWeight={emphasis ? "700" : "500"}>
      {value}
    </Text>
  </HStack>
);

export const CompassInfoCard = ({
  isQiblaMode,
  isSavedLocation,
  isRefreshing,
  needsSettings,
  northReferenceLabel,
  sensorAccuracyText,
  qiblaDirectionText,
  qiblaCardinalText,
  distanceText,
  locationAccuracyText,
  fallbackWarningTitle,
  fallbackWarningBody,
  onRefresh,
  onOpenSettings,
}: CompassInfoCardProps) => {
  const { t } = useTranslation();

  return (
    <Card
      width="100%"
      maxWidth={420}
      padding="$5"
      gap="$4"
      accessibilityLiveRegion="polite"
      accessibilityRole="summary">
      {isQiblaMode && (
        <HStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
          <Badge action={isSavedLocation ? "warning" : "success"} size="md" variant="outline">
            <Badge.Icon as={isSavedLocation ? MapPinned : LocateFixed} />
            <Badge.Text>
              {t(isSavedLocation ? "compass.locationSaved" : "compass.locationFresh")}
            </Badge.Text>
          </Badge>
          <Button
            size="sm"
            minHeight={44}
            variant="link"
            disabled={isRefreshing}
            onPress={needsSettings ? onOpenSettings : onRefresh}
            accessibilityRole="button"
            accessibilityLabel={t(
              needsSettings ? "a11y.compass.openSettings" : "a11y.compass.refresh"
            )}
            accessibilityHint={t(
              needsSettings ? "a11y.compass.openSettingsHint" : "a11y.compass.refreshHint"
            )}
            accessibilityState={{ disabled: isRefreshing }}>
            {isRefreshing ? (
              <Button.Spinner />
            ) : (
              <Button.Icon as={needsSettings ? Settings : RefreshCw} />
            )}
            <Button.Text>
              {t(needsSettings ? "compass.action.openSettings" : "compass.action.refresh")}
            </Button.Text>
          </Button>
        </HStack>
      )}

      <VStack gap="$3">
        {qiblaDirectionText && (
          <InfoRow
            label={t("compass.qiblaDirection")}
            value={`${qiblaDirectionText}${qiblaCardinalText ? ` · ${qiblaCardinalText}` : ""}`}
            emphasis
          />
        )}
        {distanceText && <InfoRow label={t("compass.distance")} value={distanceText} />}
        <InfoRow label={t("compass.northReference")} value={northReferenceLabel} />
        <InfoRow label={t("compass.accuracy")} value={sensorAccuracyText} />
        {locationAccuracyText && (
          <InfoRow label={t("compass.locationAccuracy")} value={locationAccuracyText} />
        )}
      </VStack>

      {isSavedLocation && fallbackWarningTitle && fallbackWarningBody ? (
        <Box padding="$3" borderRadius="$4" backgroundColor="$backgroundWarning">
          <VStack gap="$1">
            <Text size="sm" bold color="$warning" textAlign="center">
              {fallbackWarningTitle}
            </Text>
            <Text size="xs" color="$warning" textAlign="center">
              {fallbackWarningBody}
            </Text>
          </VStack>
        </Box>
      ) : isSavedLocation ? (
        <Box padding="$3" borderRadius="$4" backgroundColor="$backgroundWarning">
          <Text size="xs" color="$warning" textAlign="center">
            {t("compass.locationSavedNote")}
          </Text>
        </Box>
      ) : null}

      <Text size="xs" color="$typographySecondary" textAlign="center">
        {t(isQiblaMode ? "compass.disclaimer" : "compass.compassOnlyNote")}
      </Text>
    </Card>
  );
};
