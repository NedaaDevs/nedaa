import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import { Divider } from "@/components/ui/divider";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";

// Stores
import { useAppStore } from "@/stores/app";

// Enums
import { AppLocale, AppMode } from "@/enums/app";

// Plugins
import { useTranslation } from "react-i18next";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useState } from "react";

export default function MainScreen() {
  const { mode, locale, setMode, setLocale } = useAppStore();
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");

  const [isMainView, setIsMainView] = useState(true);

  const toggleTheme = () => {
    const modes = Object.values(AppMode);
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const toggleLocale = () => {
    const locales = Object.values(AppLocale);
    const currentIndex = locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % locales.length;
    setLocale(locales[nextIndex]);
  };

  const toggleTimings = async () => {
    setIsMainView(!isMainView);
    await hapticSuccess();
  };

  return (
    <SafeAreaView className="flex-1 bg-grey dark:bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Box className="flex-1">
          <Header />
          <Divider />
          <TimingsCarousel mode={mode} />
        </Box>

        {/* Testing */}
        <Box className="mx-2">
          <Button
            className="rounded-xl bg-info shadow-lg active:opacity-80 h-14 dark:bg-secondary"
            onPress={toggleTheme}>
            <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
              {t("mode")} ({t(`${mode}`)})
            </ButtonText>
          </Button>
        </Box>
        <Divider className="my-2" />
        <Box className="mx-2">
          <Button
            className="rounded-xl bg-info shadow-lg active:opacity-80 h-14 dark:bg-secondary"
            onPress={toggleLocale}>
            <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
              {t("locale")} ({locale})
            </ButtonText>
          </Button>
        </Box>

        {/* Testing */}
      </ScrollView>
    </SafeAreaView>
  );
}
