import {
  styled,
  YStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
} from "tamagui";
import type { GetProps } from "tamagui";

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

const ToastTitle = styled(TamaguiText, {
  name: "ToastTitle",
  context: ToastContext,
  fontFamily: "$body",
  fontWeight: "700",
  fontSize: 12,

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

const ToastDescription = styled(TamaguiText, {
  name: "ToastDescription",
  context: ToastContext,
  fontFamily: "$body",
  fontWeight: "400",
  fontSize: 12,

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

// --- Compound export ---

const Toast = withStaticProperties(ToastFrame, {
  Title: ToastTitle,
  Description: ToastDescription,
});

type ToastProps = GetProps<typeof ToastFrame>;
type ToastTitleProps = GetProps<typeof ToastTitle>;
type ToastDescriptionProps = GetProps<typeof ToastDescription>;

export { Toast, ToastTitle, ToastDescription };
export type { ToastProps, ToastTitleProps, ToastDescriptionProps, ToastAction };
