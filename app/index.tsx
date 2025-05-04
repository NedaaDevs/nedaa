import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import { Divider } from "@/components/ui/divider";
import { Box } from "@/components/ui/box";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Stores
import { useAppStore } from "@/stores/app";

export default function MainScreen() {
  const { mode } = useAppStore();

  return (
    <SafeAreaView className="flex-1 bg-grey dark:bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Box className="flex-1">
          <Header />
          <Divider />
          <TimingsCarousel mode={mode} />
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
