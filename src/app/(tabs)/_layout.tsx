import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";

// Icons
import { Home, Settings, BookOpenText, Wrench, CalendarCheck } from "lucide-react-native";

// Components
import { Box } from "@/components/ui/box";
import MiniPlayerBar from "@/components/athkar/MiniPlayerBar";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Hooks
import { useTheme } from "tamagui";

const TabsLayout = () => {
  const { locale, mode } = useAppStore();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      key={`tabs-${mode}`}
      tabBar={(props: BottomTabBarProps) => (
        <Box backgroundColor="$backgroundSecondary">
          <MiniPlayerBar />
          <BottomTabBar {...props} />
        </Box>
      )}
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
          title: t("a11y.tab.home"),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="athkar"
        options={{
          title: t("a11y.tab.athkar"),
          href: isAthkarSupported(locale) ? "/(tabs)/athkar" : null,
          tabBarIcon: ({ color, size }) => <BookOpenText color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="qada"
        options={{
          title: t("a11y.tab.qada"),
          tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="tools"
        options={{
          title: t("a11y.tab.tools"),
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="compass"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t("a11y.tab.settings"),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
