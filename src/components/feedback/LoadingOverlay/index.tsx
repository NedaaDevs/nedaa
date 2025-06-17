import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Modal } from "@/components/ui/modal";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { Props } from "./types";

const LoadingOverlay: FC<Props> = ({
  visible,
  message,
  progress,
  cancellable = false,
  onCancel,
  estimatedTime,
  className = "",
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
    <Modal isOpen={visible} onClose={() => {}} size="full" closeOnOverlayClick={false}>
      <Box className="flex-1 items-center justify-center p-6">
        <Box className={`bg-background-secondary rounded-xl p-8 max-w-sm w-full ${className}`}>
          <VStack className="items-center space-y-6">
            {/* Spinner */}
            <Spinner size="large" className="text-accent-primary" />

            {/* Message */}
            <Text className="text-xl font-semibold text-typography text-center">
              {message || getDefaultMessage()}
            </Text>

            {/* Progress Bar */}
            {progress !== undefined && (
              <VStack className="w-full space-y-2">
                <Box className="w-full h-2 bg-surface-active rounded-full overflow-hidden">
                  <Box
                    className="h-full bg-accent-primary transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </Box>
                <Text className="text-sm text-typography-secondary text-center">
                  {Math.round(progress)}%
                </Text>
              </VStack>
            )}

            {/* Estimated Time */}
            {estimatedTime && (
              <Text className="text-sm text-typography-secondary text-center">
                {t("common.estimatedTime")}: {formatEstimatedTime(estimatedTime)}
              </Text>
            )}

            {/* Cancel Button */}
            {cancellable && onCancel && (
              <Button
                variant="outline"
                onPress={onCancel}
                className="w-full bg-background border-outline">
                <ButtonText className="text-typography">{t("common.cancel")}</ButtonText>
              </Button>
            )}
          </VStack>
        </Box>
      </Box>
    </Modal>
  );
};

export default LoadingOverlay;
