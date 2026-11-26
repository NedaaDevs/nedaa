import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";

import AthkarTabs from "@/components/athkar/AthkarTabs";
import { Box } from "@/components/ui/box";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder } from "@/components/ui/sky-background";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

const Athkar = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    // The sky runs under the status bar; the screen pads its own top.
    <ScreenSky>
      <Box flex={1} paddingTop={insets.top}>
        <SkyOccluder>
          <ScreenHeader
            title={t("athkar.title")}
            action={{
              icon: Settings,
              label: t("a11y.athkar.settings"),
              onPress: () => router.push(BACK_DESTINATION.SETTINGS_ATHKAR.href),
            }}
          />
        </SkyOccluder>
        <AthkarTabs />
      </Box>
    </ScreenSky>
  );
};

export default Athkar;
