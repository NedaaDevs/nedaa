import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Icon } from "@/components/ui/icon";
import { Box } from "@/components/ui/box";

// Icons
import { MapPin, X, ArrowDown } from "lucide-react-native";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  currentCity: string;
  newCity: string;
  isUpdating?: boolean;
};

const CityChangeModal: FC<Props> = ({
  isOpen,
  onClose,
  onUpdate,
  currentCity,
  newCity,
  isUpdating = false,
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent>
        <ModalCloseButton>
          <Icon as={X} color="$typographySecondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader justifyContent="center">
          <VStack alignItems="center" gap="$2">
            <Box
              width={64}
              height={64}
              borderRadius={999}
              backgroundColor="$backgroundInfo"
              alignItems="center"
              justifyContent="center">
              <Icon as={MapPin} color="$info" size="xl" />
            </Box>
            <Text size="xl" bold color="$typography" textAlign="center">
              {t("location.cityChanged.title")}
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody>
          <VStack gap="$3">
            <Text textAlign="center" color="$typographySecondary">
              {t("location.cityChanged.message")}
            </Text>

            <VStack gap="$2" alignItems="center">
              <VStack
                padding="$4"
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$outline"
                gap="$1"
                width="100%">
                <Text size="sm" fontWeight="500" color="$typographySecondary" textAlign="center">
                  {t("location.cityChanged.currentCity")}
                </Text>
                <Text size="lg" bold color="$typography" textAlign="center">
                  {currentCity}
                </Text>
              </VStack>

              <Icon as={ArrowDown} color="$typographySecondary" size="md" />

              <VStack
                padding="$4"
                backgroundColor="$backgroundSuccess"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$success"
                gap="$1"
                width="100%">
                <Text size="sm" fontWeight="500" color="$typographySecondary" textAlign="center">
                  {t("location.cityChanged.newCity")}
                </Text>
                <Text size="lg" bold color="$success" textAlign="center">
                  {newCity}
                </Text>
              </VStack>
            </VStack>

            <Text size="sm" textAlign="center" color="$typographySecondary">
              {t("location.cityChanged.description")}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack gap="$2" width="100%">
            <Button
              size="lg"
              width="100%"
              backgroundColor="$accentPrimary"
              onPress={onUpdate}
              disabled={isUpdating}>
              {isUpdating ? (
                <Button.Spinner />
              ) : (
                <Button.Text color="$typographyContrast" fontWeight="500">
                  {t("location.cityChanged.updateLocation")}
                </Button.Text>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              width="100%"
              onPress={onClose}
              disabled={isUpdating}>
              <Button.Text color="$typography">{t("common.keepCurrent")}</Button.Text>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CityChangeModal;
