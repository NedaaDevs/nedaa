import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationRoot } from "@/components/location/LocationRoot";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

export default function LocationScreen() {
  return (
    <ScreenSky>
      <LocationContent />
    </ScreenSky>
  );
}

/** The screen over its sky; the place hero is its only sky-tinted surface. */
const LocationContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t("settings.location.title")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <SkyOccluder>
        <ScreenContent paddingTop="$2" paddingBottom="$8" gap="$section">
          <LocationRoot />
        </ScreenContent>
      </SkyOccluder>
    </SkyScrollView>
  );
};
