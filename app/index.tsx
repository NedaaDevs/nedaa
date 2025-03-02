import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";

import MainScreen from "@/components/MainScreen";

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-background-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <MainScreen />
      </ScrollView>
    </SafeAreaView>
  );
}
