import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings, BookOpenText, Compass, CalendarCheck } from "lucide-react-native";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Hooks
import { useTheme } from "tamagui";

const TabsLayout = () => {
  const { locale, mode } = useAppStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      key={`tabs-${mode}`}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary.val,
        tabBarInactiveTintColor: theme.typographySecondary.val,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 5,
          backgroundColor: theme.backgroundSecondary.val,
          borderTopColor: theme.outline.val,
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
