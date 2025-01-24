import { useEffect } from "react";
import {
  useToast,
  Toast,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast";
import { useToastStore } from "@/stores/toast";

export const ToastContainer = () => {
  const toast = useToast();
  const { message, options } = useToastStore();

  useEffect(() => {
    if (message) {
      toast.show({
        placement: options.placement,
        duration: options.duration,
        render: () => (
          <Toast variant={options.variant} action={options.action}>
            <ToastTitle>{message}</ToastTitle>
            {options.description && (
              <ToastDescription>{options.description}</ToastDescription>
            )}
          </Toast>
        ),
      });

      useToastStore.getState().hideToast();
    }
  }, [message, options, toast]);

  return null;
};
