import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Platform } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonText } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";

// Icons
import { MapPin, RefreshCw, Info, X } from "lucide-react-native";

// Stores
import { useLocationStore } from "@/stores/location";

// Utils
import { checkLocationPermission, requestLocationPermission } from "@/utils/location";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";

const LoadingView = () => (
  <Box className="flex-1 items-center justify-center p-4">
    <ActivityIndicator size="large" className="text-accent-primary" />
  </Box>
);

const PermissionRequestView = ({
  canAskPermission,
  onRequestPermission,
  onOpenSettings,
}: {
  canAskPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <VStack className="flex-1 p-4 items-center justify-center" space="lg">
      <Card className="p-6 w-full" style={{ maxWidth: 320 }}>
        <VStack space="lg" className="items-center">
          <Box className="w-20 h-20 rounded-full bg-background-info items-center justify-center">
            <Icon className="text-info" as={MapPin} size="xl" />
          </Box>

          <VStack space="sm" className="items-center">
            <Text className="text-xl font-semibold text-typography text-center">
              {t("location.permission.title")}
            </Text>
            <Text className="text-sm text-typography-secondary text-center px-2">
              {t("location.permission.description")}
            </Text>
          </VStack>

          {canAskPermission ? (
            <Box className="w-full items-center">
              <Button
                onPress={onRequestPermission}
                className="px-12"
                size="lg"
                accessibilityLabel={t("accessibility.allowLocationPermission")}
                accessibilityHint={t("accessibility.grantPermissionForLocation")}>
                <ButtonText className="font-medium">{t("location.permission.allow")}</ButtonText>
              </Button>
            </Box>
          ) : (
            <VStack space="sm" className="w-full items-center">
              <Text className="text-md text-typography text-center px-2">
                {t("location.permission.deniedMessage")}
              </Text>
              <Button
                onPress={onOpenSettings}
                className="px-12"
                size="lg"
                accessibilityLabel={t("accessibility.openDeviceSettings")}
                accessibilityHint={t("accessibility.openSettingsToEnableLocation")}>
                <ButtonText className="font-medium text-md">
                  {t("location.permission.openSettings")}
                </ButtonText>
              </Button>
            </VStack>
          )}
        </VStack>
      </Card>
    </VStack>
  );
};

const InfoModal = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const hapticLight = useHaptic("light");

  return (
    <Modal isOpen={isVisible} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl relative">
        <ModalCloseButton
          className="absolute top-4 right-4 z-10"
          accessibilityLabel={t("accessibility.closeModal")}
          accessibilityHint={t("accessibility.closesCurrentDialog")}>
          <Icon as={X} className="text-typography-secondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader className="px-6 pt-6 pb-4 pr-12">
          <Text className="text-lg font-semibold text-typography text-left">
            {t("location.settings.keepLocationUpdated.infoTitle")}
          </Text>
        </ModalHeader>

        <ModalBody className="px-6">
          <Text className="text-left text-sm text-typography-secondary leading-relaxed">
            {t("location.settings.keepLocationUpdated.infoDescription")}
          </Text>
        </ModalBody>

        <ModalFooter className="px-6 py-6">
          <Button
            onPress={() => {
              hapticLight();
              onClose();
            }}
            className="w-full bg-accent-primary"
            accessibilityLabel={t("common.ok")}
            accessibilityHint={t("accessibility.closesCurrentDialog")}>
            <ButtonText className="text-background">{t("common.ok")}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const KeepLocationUpdated = () => {
  const { becameActiveAt } = useAppVisibility();
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");

  const {
    localizedLocation,
    locationDetails,
    isGettingLocation,
    autoUpdateLocation,
    setAutoUpdateLocation,
    updateCurrentLocation,
  } = useLocationStore();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canAskPermission, setCanAskPermission] = useState(true);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Re-check permission when app becomes active (user returns from settings)
  useEffect(() => {
    checkPermissionStatus();
  }, [becameActiveAt]);

  const checkPermissionStatus = async () => {
    setIsCheckingPermission(true);
    try {
      const { granted, canRequestAgain } = await checkLocationPermission();
      setHasPermission(granted);
      setCanAskPermission(canRequestAgain);
    } catch (error) {
      console.error("Failed to check permission:", error);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const handleRequestPermission = async () => {
    hapticMedium();
    try {
      const { granted } = await requestLocationPermission();
      setHasPermission(granted);

      const { canRequestAgain } = await checkLocationPermission();
      setCanAskPermission(canRequestAgain);
    } catch (error) {
      console.error("Failed to request permission:", error);
    }
  };

  const openAppSettings = () => {
    hapticMedium();
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const handleManualRefresh = async () => {
    hapticMedium();
    try {
      await updateCurrentLocation();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleAutoLocationUpdated = (value: boolean) => {
    hapticSelection();
    setAutoUpdateLocation(value);
  };

  if (isCheckingPermission) {
    return <LoadingView />;
  }

  if (!hasPermission) {
    return (
      <PermissionRequestView
        canAskPermission={canAskPermission}
        onRequestPermission={handleRequestPermission}
        onOpenSettings={openAppSettings}
      />
    );
  }

  return (
    <VStack className="flex-1" space="md">
      {/* Current Location Section */}
      <Box className="bg-background-secondary mt-2 rounded-lg">
        <Pressable
          onPress={handleManualRefresh}
          disabled={isGettingLocation}
          className="py-5 px-5 flex-row justify-between items-center"
          accessibilityRole="button"
          accessibilityLabel={t("accessibility.refreshCurrentLocation")}
          accessibilityHint={t("accessibility.updatesLocationAndPrayerTimes")}
          accessibilityState={{ disabled: isGettingLocation }}>
          <HStack className="items-center flex-1" space="md">
            <Icon as={MapPin} className="text-accent-primary" size="md" />
            <VStack className="flex-1">
              <Text className="text-left text-sm text-typography-secondary">
                {t("location.current")}
              </Text>
              <Text className="text-left text-xl font-semibold text-typography">
                {localizedLocation.city ?? locationDetails.address?.city},{" "}
                {localizedLocation.country ?? locationDetails.address?.country}
              </Text>
            </VStack>
          </HStack>

          {isGettingLocation ? (
            <ActivityIndicator size="small" className="text-accent-primary" />
          ) : (
            <Icon as={RefreshCw} className="text-accent-primary" size="md" />
          )}
        </Pressable>

        {locationDetails.error && (
          <Box className="px-5 pb-3">
            <Text className="text-sm text-error">{locationDetails.error}</Text>
          </Box>
        )}
      </Box>

      {/* Keep Location Updated Setting */}
      <Box className="bg-background-secondary rounded-lg">
        <Box className="py-4 px-5 flex-row justify-between items-center">
          <HStack className="items-center flex-1" space="sm">
            <Text className="text-base text-typography">
              {t("location.settings.keepLocationUpdated.title")}
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setShowInfoModal(true);
              }}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel={t("accessibility.moreInfo")}
              accessibilityHint={t("accessibility.showsLocationUpdateInfo")}>
              <Icon as={Info} className="text-typography-secondary" size="sm" />
            </Pressable>
          </HStack>
          <Switch
            value={autoUpdateLocation}
            onValueChange={toggleAutoLocationUpdated}
            accessibilityLabel={t("accessibility.autoUpdateLocation")}
            accessibilityHint={t("accessibility.automaticallyUpdateLocationWhenChanged")}
            accessibilityState={{ checked: autoUpdateLocation }}
          />
        </Box>
      </Box>

      <InfoModal isVisible={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </VStack>
  );
};

export default KeepLocationUpdated;
