import { Stack } from "expo-router";

export default function QuranListenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="surahs" />
    </Stack>
  );
}
