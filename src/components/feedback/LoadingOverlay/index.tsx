import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Modal } from "@/components/ui/modal";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { Props } from "./types";

const LoadingOverlay: FC<Props> = ({
  visible,
  message,
  progress,
  cancellable = false,
  onCancel,
  estimatedTime,
}) => {
  const { t } = useTranslation();

  const getDefaultMessage = () => {
    if (progress !== undefined) {
      return t("common.loading");
    }
    return t("common.loading");
  };

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) {
      return t("common.minute_other", { count: Math.ceil(seconds / 60) });
    }
    const minutes = Math.ceil(seconds / 60);
    return t("common.minute_other", { count: minutes });
  };

  return (
    <Modal isOpen={visible} onClose={() => {}} size="full">
      <Box flex={1} alignItems="center" justifyContent="center" padding="$6">
        <Box
          backgroundColor="$backgroundSecondary"
          borderRadius="$6"
          padding="$8"
          maxWidth={384}
          width="100%">
          <VStack alignItems="center" gap="$6">
            {/* Spinner */}
            <Spinner size="large" />

            {/* Message */}
            <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
              {message || getDefaultMessage()}
            </Text>

            {/* Progress Bar */}
            {progress !== undefined && (
              <VStack width="100%" gap="$2">
                <Box
                  width="100%"
                  height={8}
                  backgroundColor="$backgroundMuted"
                  borderRadius={999}
                  overflow="hidden">
                  <Box
                    height="100%"
                    backgroundColor="$accentPrimary"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </Box>
                <Text size="sm" color="$typographySecondary" textAlign="center">
                  {Math.round(progress)}%
                </Text>
              </VStack>
            )}

            {/* Estimated Time */}
            {estimatedTime && (
              <Text size="sm" color="$typographySecondary" textAlign="center">
                {t("common.estimatedTime")}: {formatEstimatedTime(estimatedTime)}
              </Text>
            )}

            {/* Cancel Button */}
            {cancellable && onCancel && (
              <Button
                variant="outline"
                onPress={onCancel}
                width="100%"
                backgroundColor="$background"
                borderColor="$outline">
                <Button.Text color="$typography">{t("common.cancel")}</Button.Text>
              </Button>
            )}
          </VStack>
        </Box>
      </Box>
    </Modal>
  );
};

export default LoadingOverlay;
