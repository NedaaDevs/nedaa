import { Stack } from "expo-router";

export default function PrepareLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ihram" />
      <Stack.Screen name="miqat" />
      <Stack.Screen name="prohibitions" />
    </Stack>
  );
}
