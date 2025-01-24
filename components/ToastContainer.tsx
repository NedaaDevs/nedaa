import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import { useToastStore } from "@/stores/toast";
import { Motion } from "@legendapp/motion";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ToastProvider() {
  const { message, title, type, isVisible } = useToastStore();
  const insets = useSafeAreaInsets();

  if (!isVisible) return null;

  return (
    <Motion.View
      style={[
        {
          position: Platform.OS === "web" ? "fixed" : "absolute",
          top: insets.top + 10,
          left: 10,
          right: 10,
          zIndex: 50,
        },
      ]}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Toast action={type}>
        {title && <ToastTitle>{title}</ToastTitle>}
        <ToastDescription>{message}</ToastDescription>
      </Toast>
    </Motion.View>
  );
}
