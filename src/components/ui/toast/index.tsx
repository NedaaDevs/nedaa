import React from "react";
import { Platform } from "react-native";
import {
  styled,
  YStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
} from "tamagui";
import type { GetProps } from "tamagui";
import { PlatformType } from "@/enums/app";
import { useTextScale } from "@/hooks/useTextScale";

type ToastAction = "error" | "warning" | "success" | "info" | "muted";

const ToastContext = createStyledContext({
  action: "muted" as ToastAction,
});

// --- ToastFrame ---

const ToastFrame = styled(YStack, {
  name: "Toast",
  context: ToastContext,
  role: "alert",
  paddingHorizontal: "$4",
  paddingVertical: "$3",
  borderRadius: "$4",
  borderWidth: 1,
  gap: "$1",

  variants: {
    action: {
      error: {
        backgroundColor: "$backgroundError",
        borderColor: "$borderError",
      },
      warning: {
        backgroundColor: "$backgroundWarning",
        borderColor: "$borderWarning",
      },
      success: {
        backgroundColor: "$backgroundSuccess",
        borderColor: "$borderSuccess",
      },
      info: {
        backgroundColor: "$backgroundInfo",
        borderColor: "$borderInfo",
      },
      muted: {
        backgroundColor: "$backgroundMuted",
        borderColor: "$outline",
      },
    },
  } as const,

  defaultVariants: {
    action: "muted",
  },
});

// --- ToastTitle ---

const ToastTitleFrame = styled(TamaguiText, {
  name: "ToastTitle",
  context: ToastContext,
  fontFamily: "$body",
  fontWeight: "700",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 4 }),

  variants: {
    action: {
      error: { color: "$error" },
      warning: { color: "$warning" },
      success: { color: "$success" },
      info: { color: "$info" },
      muted: { color: "$typography" },
    },
  } as const,
});

// --- ToastDescription ---

const ToastDescriptionFrame = styled(TamaguiText, {
  name: "ToastDescription",
  context: ToastContext,
  fontFamily: "$body",
  fontWeight: "400",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 4 }),

  variants: {
    action: {
      error: { color: "$error" },
      warning: { color: "$warning" },
      success: { color: "$success" },
      info: { color: "$info" },
      muted: { color: "$typography" },
    },
  } as const,
});

// Toast copy is fixed 12px chrome; the app text-scale multiplies it and the
// OS scale stays off (the app owns text size).
const TOAST_FONT_SIZE = 12;

type ToastTitleProps = GetProps<typeof ToastTitleFrame> & { scaleOverride?: number };

const ToastTitle = React.forwardRef<React.ComponentRef<typeof ToastTitleFrame>, ToastTitleProps>(
  ({ fontSize, scaleOverride, ...props }, ref) => {
    const appScale = useTextScale();
    const m = scaleOverride ?? appScale;
    const base = typeof fontSize === "number" ? fontSize : TOAST_FONT_SIZE;
    return <ToastTitleFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />;
  }
);
ToastTitle.displayName = "ToastTitle";

type ToastDescriptionProps = GetProps<typeof ToastDescriptionFrame> & { scaleOverride?: number };

const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastDescriptionFrame>,
  ToastDescriptionProps
>(({ fontSize, scaleOverride, ...props }, ref) => {
  const appScale = useTextScale();
  const m = scaleOverride ?? appScale;
  const base = typeof fontSize === "number" ? fontSize : TOAST_FONT_SIZE;
  return (
    <ToastDescriptionFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />
  );
});
ToastDescription.displayName = "ToastDescription";

// --- Compound export ---

const Toast = withStaticProperties(ToastFrame, {
  Title: ToastTitle,
  Description: ToastDescription,
});

type ToastProps = GetProps<typeof ToastFrame>;

export { Toast, ToastTitle, ToastDescription };
export type { ToastProps, ToastTitleProps, ToastDescriptionProps, ToastAction };
