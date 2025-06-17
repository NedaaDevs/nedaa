import React from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonText } from "@/components/ui/button";

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
        iconColor: "text-error",
        bgColor: "bg-background-error",
        title: t("errors.prayerTimes.fetchFailed"),
        description: t("errors.prayerTimes.fetchDescription"),
        retryLabel: t("common.retry"),
      };
    case "offline":
      return {
        icon: Wifi,
        iconColor: "text-warning",
        bgColor: "bg-background-warning",
        title: t("network.noConnection"),
        description: t("network.messages.offline"),
        retryLabel: t("common.retry"),
      };
    case "noLocation":
      return {
        icon: MapPin,
        iconColor: "text-info",
        bgColor: "bg-background-info",
        title: t("location.permission.title"),
        description: t("location.permission.description"),
        retryLabel: t("location.permission.allow"),
      };
    case "noData":
    default:
      return {
        icon: RefreshCw,
        iconColor: "text-typography-secondary",
        bgColor: "bg-background-muted",
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
    <VStack className="flex-1 items-center justify-center p-8" space="lg">
      {/* Icon */}
      <Box className={`w-20 h-20 rounded-full ${config.bgColor} items-center justify-center`}>
        <Icon className={`${config.iconColor}`} as={config.icon} size="xl" />
      </Box>

      {/* Content */}
      <VStack space="sm" className="items-center max-w-xs">
        <Text className="text-xl font-semibold text-typography text-center">
          {title || config.title}
        </Text>
        <Text className="text-sm text-typography-secondary text-center leading-relaxed">
          {description || config.description}
        </Text>
      </VStack>

      {/* Action Button */}
      {onRetry && (
        <Button onPress={handleRetry} disabled={isRetrying} size="lg" className="px-8">
          <ButtonText className="font-medium">
            {isRetrying ? t("common.loading") : retryLabel || config.retryLabel}
          </ButtonText>
        </Button>
      )}
    </VStack>
  );
};

export default EmptyState;
