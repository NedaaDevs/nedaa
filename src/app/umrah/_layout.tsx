import { Stack } from "expo-router";

export default function UmrahLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="step" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
