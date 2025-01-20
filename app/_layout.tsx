import "@/global.css";
import "@/localization/i18n";

import { Stack } from "expo-router";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { useAppStore } from "@/stores/app";

export default function RootLayout() {
  const { mode } = useAppStore();
  return (
    <GluestackUIProvider mode={mode}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GluestackUIProvider>
  );
}
