import { useTranslation } from "react-i18next";
import { Download } from "lucide-react-native";

// Components
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";

// Constants
import { CITIES_FULL_CITY_COUNT, CITIES_PACK_BYTES } from "@/constants/Cities";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

export const formatMegabytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Standing offer to expand the searchable set. It is present whenever only the seed is
 * installed rather than appearing on an empty search, so the option is never something
 * the user has to discover at the moment their city turns out to be missing.
 */
const CitiesPackRow = () => {
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");
  const { isDownloading, receivedBytes, totalBytes, error, download, cancel } =
    useCitiesPackStore();

  const size = formatMegabytes(CITIES_PACK_BYTES);

  if (isDownloading) {
    const total = totalBytes > 0 ? totalBytes : CITIES_PACK_BYTES;

    return (
      <Card variant="grouped" marginHorizontal="$4">
        <HStack alignItems="center" gap="$3" padding="$4">
          <Spinner size="small" />
          <VStack flex={1}>
            <Text size="sm" color="$typography">
              {t("location.picker.packDownloading")}
            </Text>
            <Text size="xs" color="$typographySecondary">
              {formatMegabytes(receivedBytes)} / {formatMegabytes(total)}
            </Text>
          </VStack>
          <Button
            size="sm"
            variant="outline"
            onPress={cancel}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.location.picker.cancelDownload")}>
            <Button.Text>{t("location.picker.packCancel")}</Button.Text>
          </Button>
        </HStack>
      </Card>
    );
  }

  return (
    <Card variant="grouped" marginHorizontal="$4">
      <Pressable
        onPress={() => {
          hapticMedium();
          void download();
        }}
        minHeight={44}
        padding="$4"
        accessibilityRole="button"
        accessibilityLabel={t("a11y.location.picker.downloadPack", { size })}>
        <HStack alignItems="center" gap="$3">
          <Icon as={Download} color="$accentPrimary" size="md" />
          <VStack flex={1}>
            <Text size="sm" color={error ? "$error" : "$typography"}>
              {error ? t("location.picker.packFailed") : t("location.picker.packRow")}
            </Text>
            <Box>
              <Text size="xs" color="$typographySecondary">
                {t("location.picker.packRowDetail", { count: CITIES_FULL_CITY_COUNT, size })}
              </Text>
            </Box>
          </VStack>
        </HStack>
      </Pressable>
    </Card>
  );
};

export default CitiesPackRow;
