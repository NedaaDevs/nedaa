import { StyleSheet, Pressable } from "react-native";

import { Text, View } from "@/components/Themed";

// Stores
import { useAppStore } from "@/stores/app";

// Enums
import { AppLocale, AppMode } from "@/enums/app";

import { useTranslation } from "react-i18next";

export default function TabOneScreen() {
  const { locale, mode, setLocale, setMode, setIsFirstRun } = useAppStore();

  const { t, i18n } = useTranslation();

  const toggleMode = () => {
    setMode(mode === AppMode.DARK ? AppMode.LIGHT : AppMode.DARK);
  };

  const toggleLanguage = () => {
    // Simulate how is should be done
    setIsFirstRun(false);
    const languages = Object.values(AppLocale);

    const currentIndex = languages.indexOf(locale);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLocale(languages[nextIndex]);
    i18n.changeLanguage(languages[nextIndex]);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nedaa | نداء</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text>
        {t("deviceLocale")}: {t(locale)}
      </Text>
      <Pressable onPress={toggleLanguage}>
        <Text>{t("toggleLanguage")}</Text>
      </Pressable>

      <Text>
        {t("mode")}: {mode}
      </Text>
      <Pressable onPress={toggleMode}>
        <Text>{t("toggleMode")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
