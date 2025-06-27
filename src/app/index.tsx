import { View } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Settings } from "lucide-react-native";

export default function MainScreen() {
  const { mode } = useAppStore();
  const { t } = useTranslation();

  return (
    <Background>
      <View style={{ flex: 1 }} accessibilityLabel={t("accessibility.prayerTimesApp")}>
        <Box>
          <TopBar title="common.nedaa" href="/settings" icon={Settings} />
          <Header />
        </Box>

        <Box className="flex-1">
          <TimingsCarousel mode={mode} />
        </Box>
      </View>
    </Background>
  );
}
