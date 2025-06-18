import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Modal } from "@/components/ui/modal";
import { ModalBackdrop } from "@/components/ui/modal";
import { ModalContent } from "@/components/ui/modal";
import { ModalHeader } from "@/components/ui/modal";
import { ModalCloseButton } from "@/components/ui/modal";
import { ModalBody } from "@/components/ui/modal";
import { ModalFooter } from "@/components/ui/modal";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Icon } from "@/components/ui/icon";
import { Box } from "@/components/ui/box";

// Icons
import { MapPin, X } from "lucide-react-native";

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
      <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl relative">
        <ModalCloseButton className="absolute top-4 right-4 z-10">
          <Icon as={X} className="text-typography-secondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader className="justify-items-center px-6 pt-6 pb-2 pr-12">
          <VStack className=" items-center" space="sm">
            <Box className="w-16 h-16 rounded-full bg-background-info items-center justify-center">
              <Icon as={MapPin} className="text-info" size="xl" />
            </Box>
            <Text className="text-xl font-bold text-typography text-center">
              {t("location.cityChanged.title")}
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody className="px-6 pt-2">
          <VStack space="md">
            <Text className="text-center text-typography-secondary leading-relaxed">
              {t("location.cityChanged.message")}
            </Text>

            <VStack space="sm">
              <VStack className="p-4 bg-background rounded-lg border border-outline" space="xs">
                <Text className="text-sm font-medium text-typography-secondary text-center">
                  {t("location.cityChanged.currentCity")}
                </Text>
                <Text className="text-lg font-bold text-typography text-center">{currentCity}</Text>
              </VStack>

              <VStack
                className="p-4 bg-background-success/10 rounded-lg border border-success/20"
                space="xs">
                <Text className="text-sm font-medium text-typography-secondary text-center">
                  {t("location.cityChanged.newCity")}
                </Text>
                <Text className="text-lg font-bold text-success text-center">{newCity}</Text>
              </VStack>
            </VStack>

            <Text className="text-sm text-center text-typography-secondary leading-relaxed">
              {t("location.cityChanged.description")}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter className="px-6 py-6">
          <VStack space="sm" className="w-full">
            <Button
              size="lg"
              className="w-full bg-accent-primary"
              onPress={onUpdate}
              isDisabled={isUpdating}>
              <ButtonText className="text-background font-medium">
                {isUpdating
                  ? t("location.cityChanged.updating")
                  : t("location.cityChanged.updateLocation")}
              </ButtonText>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onPress={onClose}
              isDisabled={isUpdating}>
              <ButtonText className="text-typography">{t("common.keepCurrent")}</ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CityChangeModal;
