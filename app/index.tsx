import { StyleSheet, Pressable } from "react-native";

import { Text, View } from "@/components/Themed";

// Stores
import { useAppStore } from "@/stores/app";

// Enums
import { AppLocale } from "@/enums/app";

export default function TabOneScreen() {
  const { locale, setLocale, setIsFirstRun } = useAppStore();

  const toggleLanguage = () => {
    // Simulate how is should be done
    setIsFirstRun(false);
    const languages = Object.values(AppLocale);

    const currentIndex = languages.indexOf(locale);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLocale(languages[nextIndex]);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nedaa | نداء</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text>Device Locale: {locale}</Text>
      <Pressable onPress={toggleLanguage}>
        <Text>Toggle Language</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
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
