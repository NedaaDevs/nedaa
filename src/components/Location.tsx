import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ActivityIndicator, Linking, Platform } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonText } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// Icons
import { MapPin, RefreshCw, Info, X } from "lucide-react-native";

// Stores
import { useLocationStore } from "@/stores/location";

// Utils
import { checkLocationPermission, requestLocationPermission } from "@/utils/location";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";

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
              <Button onPress={onRequestPermission} className="px-12" size="lg">
                <ButtonText className="font-medium">{t("location.permission.allow")}</ButtonText>
              </Button>
            </Box>
          ) : (
            <VStack space="sm" className="w-full items-center">
              <Text className="text-md text-typography text-center px-2">
                {t("location.permission.deniedMessage")}
              </Text>
              <Button onPress={onOpenSettings} className="px-12" size="lg">
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

  return (
    <Modal isOpen={isVisible} onClose={onClose}>
      <Box className="flex-1 bg-transparent items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6 bg-background-secondary">
          <VStack space="lg">
            <HStack className="items-center justify-between">
              <Text className="text-lg font-semibold text-typography">
                {t("location.settings.keepLocationUpdated.infoTitle")}
              </Text>
              <Pressable onPress={onClose} className="p-1">
                <Icon as={X} className="text-typography-secondary" size="sm" />
              </Pressable>
            </HStack>

            <Text className="text-left text-sm text-typography-secondary leading-relaxed">
              {t("location.settings.keepLocationUpdated.infoDescription")}
            </Text>

            <Button onPress={onClose} className="mt-2">
              <ButtonText>{t("common.ok")}</ButtonText>
            </Button>
          </VStack>
        </Card>
      </Box>
    </Modal>
  );
};

const KeepLocationUpdated = () => {
  const { becameActiveAt } = useAppVisibility();
  const { t } = useTranslation();

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
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const handleManualRefresh = async () => {
    try {
      await updateCurrentLocation();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleAutoLocationUpdated = (value: boolean) => {
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
          className="py-5 px-5 flex-row justify-between items-center">
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
            <Pressable onPress={() => setShowInfoModal(true)} className="p-1">
              <Icon as={Info} className="text-typography-secondary" size="sm" />
            </Pressable>
          </HStack>
          <Switch value={autoUpdateLocation} onValueChange={toggleAutoLocationUpdated} />
        </Box>
      </Box>

      <InfoModal isVisible={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </VStack>
  );
};

export default KeepLocationUpdated;
