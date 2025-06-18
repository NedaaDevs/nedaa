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
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";

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
    <Modal isOpen={isOpen} onClose={onClose} avoidKeyboard>
      <ModalBackdrop />
      <ModalContent className="max-w-sm">
        <ModalHeader>
          <VStack className="items-center gap-2">
            <Icon as={MapPin} className="text-accent-primary" size="xl" />
            <Text className="text-lg font-semibold text-typography">
              {t("location.cityChanged.title")}
            </Text>
          </VStack>
          <ModalCloseButton>
            <Icon as={X} className="text-typography-secondary" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <VStack className="gap-4">
            <Text className="text-center text-typography-secondary">
              {t("location.cityChanged.message")}
            </Text>

            <VStack className="gap-2">
              <HStack className="justify-between items-center p-3 bg-background-secondary rounded-lg">
                <Text className="text-sm text-typography-secondary">
                  {t("location.cityChanged.currentCity")}
                </Text>
                <Text className="font-medium text-typography">{currentCity}</Text>
              </HStack>

              <HStack className="justify-between items-center p-3 bg-accent-primary/10 rounded-lg">
                <Text className="text-sm text-typography-secondary">
                  {t("location.cityChanged.newCity")}
                </Text>
                <Text className="font-medium text-accent-primary">{newCity}</Text>
              </HStack>
            </VStack>

            <Text className="text-sm text-center text-typography-tertiary">
              {t("location.cityChanged.description")}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack className="w-full gap-2">
            <Button size="lg" className="w-full" onPress={onUpdate} isDisabled={isUpdating}>
              <ButtonText>
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
              <ButtonText>{t("common.keepCurrent")}</ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CityChangeModal;
