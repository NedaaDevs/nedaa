import { View } from "react-native";

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

  return (
    <Background>
      <View style={{ flex: 1 }}>
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
