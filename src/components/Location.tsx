import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button } from "@/components/ui/button";
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
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Utils
import { checkLocationPermission, requestLocationPermission } from "@/utils/location";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";

const LoadingView = () => (
  <Box flex={1} alignItems="center" justifyContent="center" padding="$4">
    <Spinner size="large" />
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
    <VStack flex={1} padding="$4" alignItems="center" justifyContent="center" gap="$4">
      <Card padding="$6" width="100%" style={{ maxWidth: 320 }}>
        <VStack gap="$4" alignItems="center">
          <Box
            width={80}
            height={80}
            borderRadius={999}
            backgroundColor="$backgroundInfo"
            alignItems="center"
            justifyContent="center">
            <Icon color="$info" as={MapPin} size="xl" />
          </Box>

          <VStack gap="$2" alignItems="center">
            <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
              {t("location.permission.title")}
            </Text>
            <Text size="sm" color="$typographySecondary" textAlign="center" paddingHorizontal="$2">
              {t("location.permission.description")}
            </Text>
          </VStack>

          {canAskPermission ? (
            <Box width="100%" alignItems="center">
              <Button onPress={onRequestPermission} paddingHorizontal="$7" size="lg">
                <Button.Text fontWeight="500">{t("location.permission.allow")}</Button.Text>
              </Button>
            </Box>
          ) : (
            <VStack gap="$2" width="100%" alignItems="center">
              <Text color="$typography" textAlign="center" paddingHorizontal="$2">
                {t("location.permission.deniedMessage")}
              </Text>
              <Button onPress={onOpenSettings} paddingHorizontal="$7" size="lg">
                <Button.Text fontWeight="500">{t("location.permission.openSettings")}</Button.Text>
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
      <ModalContent>
        <ModalCloseButton>
          <Icon as={X} color="$typographySecondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader>
          <Text size="lg" fontWeight="600" color="$typography">
            {t("location.settings.keepLocationUpdated.infoTitle")}
          </Text>
        </ModalHeader>

        <ModalBody>
          <Text size="sm" color="$typographySecondary">
            {t("location.settings.keepLocationUpdated.infoDescription")}
          </Text>
        </ModalBody>

        <ModalFooter>
          <Button
            onPress={() => {
              hapticLight();
              onClose();
            }}
            width="100%"
            backgroundColor="$accentPrimary">
            <Button.Text color="$typographyContrast">{t("common.ok")}</Button.Text>
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

  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();

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
      await loadPrayerTimes(true);
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
    <VStack flex={1} gap="$3">
      {/* Current Location Section */}
      <Box backgroundColor="$backgroundSecondary" marginTop="$2" borderRadius="$4">
        <Pressable
          onPress={handleManualRefresh}
          disabled={isGettingLocation || isFetchingPrayers}
          paddingVertical="$5"
          paddingHorizontal="$5"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center">
          <HStack alignItems="center" flex={1} gap="$3">
            <Icon as={MapPin} color="$accentPrimary" size="md" />
            <VStack flex={1}>
              <Text size="sm" color="$typographySecondary">
                {t("location.current")}
              </Text>
              <Text size="xl" fontWeight="600" color="$typography">
                {localizedLocation.city ?? locationDetails.address?.city},{" "}
                {localizedLocation.country ?? locationDetails.address?.country}
              </Text>
            </VStack>
          </HStack>

          {isGettingLocation || isFetchingPrayers ? (
            <Spinner size="small" />
          ) : (
            <Icon as={RefreshCw} color="$accentPrimary" size="md" />
          )}
        </Pressable>

        {locationDetails.error && (
          <Box paddingHorizontal="$5" paddingBottom="$3">
            <Text size="sm" color="$error">
              {locationDetails.error}
            </Text>
          </Box>
        )}
      </Box>

      {/* Keep Location Updated Setting */}
      <Box backgroundColor="$backgroundSecondary" borderRadius="$4">
        <Box
          paddingVertical="$4"
          paddingHorizontal="$5"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center">
          <HStack alignItems="center" flex={1} gap="$2">
            <Text color="$typography">{t("location.settings.keepLocationUpdated.title")}</Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setShowInfoModal(true);
              }}
              padding="$2"
              minHeight={44}
              minWidth={44}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("location.settings.keepLocationUpdated.infoTitle")}>
              <Icon as={Info} color="$typographySecondary" size="sm" />
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
