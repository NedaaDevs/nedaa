import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { useToastStore } from "@/stores/toast";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";

export function ToastProvider() {
  const { message, title, type, isVisible } = useToastStore();
  const insets = useSafeAreaInsets();

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={{
        position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
        top: insets.top + 10,
        left: 10,
        right: 10,
        zIndex: 50,
      }}>
      <Toast action={type}>
        {title && <ToastTitle>{title}</ToastTitle>}
        <ToastDescription>{message}</ToastDescription>
      </Toast>
    </Animated.View>
  );
}
