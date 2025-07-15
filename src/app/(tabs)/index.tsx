import { View } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Background } from "@/components/ui/background";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Stores
import { useAppStore } from "@/stores/app";

export default function MainScreen() {
  const { mode } = useAppStore();

  return (
    <Background>
      <View style={{ flex: 1 }}>
        <Box>
          <Header />
        </Box>

        <Box className="flex-1">
          <TimingsCarousel mode={mode} />
        </Box>
      </View>
    </Background>
  );
}
