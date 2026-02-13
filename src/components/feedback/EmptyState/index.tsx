import React from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

// Icons
import { RefreshCw, MapPin, Wifi, AlertCircle } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Types
type EmptyStateType = "error" | "offline" | "noLocation" | "noData";

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
}

const getEmptyStateConfig = (type: EmptyStateType, t: any) => {
  switch (type) {
    case "error":
      return {
        icon: AlertCircle,
        iconColor: "$error",
        bgColor: "$backgroundError",
        title: t("errors.prayerTimes.fetchFailed"),
        description: t("errors.prayerTimes.fetchDescription"),
        retryLabel: t("common.retry"),
      };
    case "offline":
      return {
        icon: Wifi,
        iconColor: "$warning",
        bgColor: "$backgroundWarning",
        title: t("network.noConnection"),
        description: t("network.messages.offline"),
        retryLabel: t("common.retry"),
      };
    case "noLocation":
      return {
        icon: MapPin,
        iconColor: "$info",
        bgColor: "$backgroundInfo",
        title: t("location.permission.title"),
        description: t("location.permission.description"),
        retryLabel: t("location.permission.allow"),
      };
    case "noData":
    default:
      return {
        icon: RefreshCw,
        iconColor: "$typographySecondary",
        bgColor: "$backgroundMuted",
        title: t("prayerTimes.noData"),
        description: t("prayerTimes.noDataDescription"),
        retryLabel: t("common.retry"),
      };
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  onRetry,
  retryLabel,
  isRetrying = false,
}) => {
  const { t } = useTranslation();
  const haptic = useHaptic("selection");

  const config = getEmptyStateConfig(type, t);

  const handleRetry = () => {
    haptic();
    onRetry?.();
  };

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" padding="$8" gap="$4">
      {/* Icon */}
      <Box
        width={80}
        height={80}
        borderRadius={999}
        backgroundColor={config.bgColor}
        alignItems="center"
        justifyContent="center">
        <Icon color={config.iconColor} as={config.icon} size="xl" />
      </Box>

      {/* Content */}
      <VStack gap="$2" alignItems="center" maxWidth={280}>
        <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
          {title || config.title}
        </Text>
        <Text size="sm" color="$typographySecondary" textAlign="center">
          {description || config.description}
        </Text>
      </VStack>

      {/* Action Button */}
      {onRetry && (
        <Button onPress={handleRetry} disabled={isRetrying} size="lg" paddingHorizontal="$8">
          <Button.Text fontWeight="500">
            {isRetrying ? t("common.loading") : retryLabel || config.retryLabel}
          </Button.Text>
        </Button>
      )}
    </VStack>
  );
};

export default EmptyState;
