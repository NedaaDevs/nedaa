import { Tabs } from "expo-router";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings, BookOpenText, Compass } from "lucide-react-native";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Hooks
import { useColorScheme } from "nativewind";

const TabsLayout = () => {
  const { locale, mode } = useAppStore();

  const colorScheme = useColorScheme();

  return (
    <Tabs
      key={`tabs-${mode}`}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colorScheme.colorScheme === "dark" ? "#E6C469" : "#1C5D85",
        tabBarInactiveTintColor: colorScheme.colorScheme === "dark" ? "#E3E2CE" : "#64748B",
        tabBarStyle: {
          height: 70,
          paddingBottom: 5,
          paddingTop: 5,
          backgroundColor: colorScheme.colorScheme === "dark" ? "#393E46" : "#FFFFFF",
          borderTopColor:
            colorScheme.colorScheme === "dark" ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
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
        name="compass"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
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
