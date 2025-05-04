import { ScrollView } from "react-native";

// Components
import { Divider } from "@/components/ui/divider";
import { Box } from "@/components/ui/box";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Plugins
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Settings } from "lucide-react-native";
export default function MainScreen() {
  const { mode } = useAppStore();

  const { t } = useTranslation();

  return (
    <ScrollView className="bg-grey dark:bg-black" contentContainerStyle={{ flexGrow: 1 }}>
      <TopBar title="nedaa" href="/settings" icon={Settings} />
      <Box className="flex-1">
        <Header />
        <Divider />
        <TimingsCarousel mode={mode} />
      </Box>
    </ScrollView>
  );
}
