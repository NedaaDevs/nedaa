import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";
import { PlaceHero } from "@/components/ui/place-hero";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import {
  CITY_PICKER_VIEW,
  LOCATION_PICKER,
  locationPickerRoute,
  type CityPickerView,
} from "@/constants/Location";
import { PLACE_HERO_TONE } from "@/constants/PlaceHero";
import { usePlaceHandOver } from "@/hooks/usePlaceHandOver";

const TITLES: Record<CityPickerView, ParseKeys> = {
  [CITY_PICKER_VIEW.LIST]: "location.picker.title",
  [CITY_PICKER_VIEW.COORDINATES]: "location.coordinates.title",
};

/** The city list or coordinate entry; a chosen place goes back to Location. */
const PickerContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handOver = usePlaceHandOver();
  const params = useLocalSearchParams<Partial<Record<typeof LOCATION_PICKER.viewParam, string>>>();
  // Anything but coordinates opens the list.
  const view =
    params[LOCATION_PICKER.viewParam] === CITY_PICKER_VIEW.COORDINATES
      ? CITY_PICKER_VIEW.COORDINATES
      : CITY_PICKER_VIEW.LIST;

  // Pushed over the list, so back from coordinates returns to it.
  const openCoordinates = () => router.push(locationPickerRoute(CITY_PICKER_VIEW.COORDINATES));

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t(TITLES[view])}
          back={{ fallback: BACK_DESTINATION.SETTINGS_LOCATION }}
        />
      </SkyOccluder>

      <SkyOccluder>
        <ScreenContent paddingTop="$2" paddingBottom="$8">
          {view === CITY_PICKER_VIEW.LIST ? (
            <CityPicker onPick={handOver} onEnterCoordinates={openCoordinates} />
          ) : (
            <VStack gap="$3.5">
              {/* A typed place is a chosen one, so it takes the city tint. */}
              <PlaceHero
                tone={PLACE_HERO_TONE.CITY}
                kicker={t("location.hero.coordinatesKicker")}
                title={t("location.hero.coordinatesTitle")}
                subtitle={t("location.hero.coordinatesNote")}
              />
              <CoordinateEntry onSave={handOver} />
            </VStack>
          )}
        </ScreenContent>
      </SkyOccluder>
    </SkyScrollView>
  );
};

const LocationPickerScreen = () => (
  <SkyBackground>
    <PickerContent />
  </SkyBackground>
);

export default LocationPickerScreen;
