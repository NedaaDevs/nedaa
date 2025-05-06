import { ScrollView } from "react-native";

// Components
import { Divider } from "@/components/ui/divider";
import { Box } from "@/components/ui/box";
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
    <ScrollView className="bg-grey dark:bg-black" contentContainerStyle={{ flexGrow: 1 }}>
      <TopBar title="nedaa" href="/settings" icon={Settings} />
      <Box className="flex-1">
        <Header />
        <Divider className="my-3" />
        <TimingsCarousel mode={mode} />
      </Box>
    </ScrollView>
  );
}
