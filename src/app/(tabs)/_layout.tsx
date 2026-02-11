import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings, BookOpenText, Compass, CalendarCheck } from "lucide-react-native";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Hooks
import { useColorScheme } from "nativewind";

const TabsLayout = () => {
  const { locale, mode } = useAppStore();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      key={`tabs-${mode}`}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colorScheme.colorScheme === "dark" ? "#E6C469" : "#1C5D85",
        tabBarInactiveTintColor: colorScheme.colorScheme === "dark" ? "#E3E2CE" : "#64748B",
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
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
        name="athkar"
        options={{
          title: "",
          href: isAthkarSupported(locale) ? "/(tabs)/athkar" : null,
          tabBarIcon: ({ color, size }) => <BookOpenText color={color} size={size} />,
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
        name="qada"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} />,
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
