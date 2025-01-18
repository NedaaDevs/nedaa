import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";

import { getLocales } from "expo-localization";

export default function TabOneScreen() {
  const deviceLanguage = getLocales()[0].languageCode;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nedaa | نداء</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text>Device Locale: {deviceLanguage}</Text>
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
