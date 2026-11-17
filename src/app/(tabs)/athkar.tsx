import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AthkarTabs from "@/components/athkar/AthkarTabs";
import { Box } from "@/components/ui/box";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder } from "@/components/ui/sky-background";

const Athkar = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // The sky runs under the status bar; the screen pads its own top.
    <ScreenSky>
      <Box flex={1} paddingTop={insets.top}>
        <SkyOccluder>
          <ScreenHeader title={t("athkar.title")} />
        </SkyOccluder>
        <AthkarTabs />
      </Box>
    </ScreenSky>
  );
};

export default Athkar;
