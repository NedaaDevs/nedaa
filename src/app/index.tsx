import { ScrollView } from "react-native";
import { Divider } from "@/components/ui/divider";
import { Box } from "@/components/ui/box";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Stores
import { useAppStore } from "@/stores/app";

export default function MainScreen() {
  const { mode } = useAppStore();

  return (
    <ScrollView className="bg-grey dark:bg-black" contentContainerStyle={{ flexGrow: 1 }}>
      <TopBar />
      <Box className="flex-1">
        <Header />
        <Divider />
        <TimingsCarousel mode={mode} />
      </Box>
    </ScrollView>
  );
}
