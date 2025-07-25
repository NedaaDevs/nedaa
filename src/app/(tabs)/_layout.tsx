import { Tabs } from "expo-router";

import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings, BookOpenText } from "lucide-react-native";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

const TabsLayout = () => {
  const { mode, locale } = useAppStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mode === "dark" ? "#E6C469" : "#1C5D85",
        tabBarInactiveTintColor: mode === "dark" ? "#E3E2CE" : "#64748B",
        tabBarStyle: {
          backgroundColor: mode === "dark" ? "#393E46" : "#FFFFFF",
          borderTopColor: mode === "dark" ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="athkar"
        options={{
          title: "",
          href: isAthkarSupported(locale) ? "/(tabs)/athkar" : null,
          tabBarIcon: ({ color, size }) => <BookOpenText color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
