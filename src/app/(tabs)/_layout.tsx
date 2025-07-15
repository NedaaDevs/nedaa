import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings } from "lucide-react-native";

const TabsLayout = () => {
  const { t } = useTranslation();
  const { mode } = useAppStore();

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
        name="settings"
        options={{
          title: t("settings.title"),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
