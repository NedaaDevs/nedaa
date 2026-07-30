import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Keyboard } from "react-native";
import { Search } from "lucide-react-native";

// Components
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";
import CityResultRow from "@/components/location/CityResultRow";
import CitiesPackRow from "@/components/location/CitiesPackRow";
import LocationUpdateProgress from "@/components/LocationUpdateProgress";

// Hooks
import { useCitySearch } from "@/hooks/useCitySearch";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";

// Constants
import { CITIES_SEED_CITY_COUNT } from "@/constants/Cities";

// Types
import type { CitySearchResult } from "@/types/cities";
import type { ManualLocation } from "@/types/location";

const toManualLocation = (city: CitySearchResult): ManualLocation => ({
  cityId: city.gid,
  name: city.name,
  names: city.names,
  region: city.region,
  countryCode: city.countryCode,
  country: city.country,
  latitude: city.latitude,
  longitude: city.longitude,
  timezone: city.timezone,
});

type CityPickerProps = {
  /** Called once the chosen city has been applied and downstream data refreshed. */
  onDone: () => void;
  onEnterCoordinates?: () => void;
};

/**
 * Self-contained city selection. It owns no navigation, so any host — settings today,
 * onboarding later — can mount it and decide what "done" means.
 */
const CityPicker = ({ onDone, onEnterCoordinates }: CityPickerProps) => {
  const { t } = useTranslation();
  const { query, setQuery, results, isSearching, offersFullPack } = useCitySearch();
  const { updateState, applyManualLocation, retry } = useLocationUpdate();
  const refreshInstalled = useCitiesPackStore((state) => state.refreshInstalled);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  // A failed refresh keeps the picker open with the error on screen so the user can retry.
  const handleSelect = async (city: CitySearchResult) => {
    Keyboard.dismiss();
    const applied = await applyManualLocation(toManualLocation(city));
    if (applied) onDone();
  };

  const hasQuery = query.trim().length > 0;

  return (
    <VStack flex={1} gap="$2">
      <Box paddingHorizontal="$4" paddingTop="$3">
        <Card variant="grouped">
          <HStack alignItems="center" gap="$2" paddingHorizontal="$3" height={44}>
            <Icon as={Search} size="sm" color="$typographySecondary" />
            <Input
              flex={1}
              value={query}
              onChangeText={setQuery}
              placeholder={t("location.picker.searchPlaceholder")}
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal="$0"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("a11y.location.picker.searchField")}
            />
            {isSearching && <Spinner size="small" />}
          </HStack>
        </Card>
      </Box>

      {offersFullPack && (
        <Box paddingHorizontal="$4">
          <Text size="xs" color="$typographySecondary">
            {t("location.picker.seedNotice", { count: CITIES_SEED_CITY_COUNT })}
          </Text>
        </Box>
      )}

      <LocationUpdateProgress state={updateState} onRetry={retry} />

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.gid)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <CityResultRow city={item} onSelect={handleSelect} disabled={updateState.isUpdating} />
        )}
        ListHeaderComponent={
          offersFullPack && results.length === 0 ? (
            <Box paddingTop="$2">
              <CitiesPackRow />
            </Box>
          ) : null
        }
        ListEmptyComponent={
          hasQuery && !isSearching ? (
            <Box padding="$5">
              <Text size="sm" color="$typographySecondary" textAlign="center">
                {t("location.picker.noResults")}
              </Text>
            </Box>
          ) : null
        }
        ListFooterComponent={
          <VStack gap="$3" paddingVertical="$4">
            {offersFullPack && results.length > 0 ? <CitiesPackRow /> : null}
            {onEnterCoordinates && (
              <Pressable
                onPress={onEnterCoordinates}
                minHeight={44}
                paddingHorizontal="$5"
                justifyContent="center"
                accessibilityRole="button"
                accessibilityLabel={t("location.picker.enterCoordinates")}
                accessibilityHint={t("a11y.location.picker.enterCoordinatesHint")}>
                <Text size="sm" color="$accentPrimary">
                  {t("location.picker.enterCoordinates")}
                </Text>
              </Pressable>
            )}
          </VStack>
        }
      />
    </VStack>
  );
};

export default CityPicker;
