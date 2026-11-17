import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AthkarTabs from "@/components/athkar/AthkarTabs";
import { Box } from "@/components/ui/box";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder } from "@/components/ui/sky-background";
import { CHOOSER_MODE } from "@/constants/AthkarLookChooser";

/** The look chooser as a screen of its own: the reader, tried on. */
const AthkarLookScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // The sky runs under the status bar; the screen pads its own top.
    <ScreenSky>
      <Box flex={1} paddingTop={insets.top}>
        <SkyOccluder>
          <ScreenHeader title={t("athkar.title")} />
        </SkyOccluder>
        <AthkarTabs chooser={CHOOSER_MODE.SETTINGS} />
      </Box>
    </ScreenSky>
  );
};

export default AthkarLookScreen;
