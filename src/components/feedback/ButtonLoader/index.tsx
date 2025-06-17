import React from "react";
import { ActivityIndicator } from "react-native";

// Components
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Types
type HapticType = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

type Props = {
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "link";
  className?: string;
  loadingText?: string;
  hapticFeedback?: HapticType;
  enableHaptic?: boolean;
};

export const ButtonLoader: React.FC<Props> = ({
  loading = false,
  disabled = false,
  onPress,
  children,
  size = "md",
  variant = "solid",
  className,
  loadingText,
  hapticFeedback = "selection",
  enableHaptic = true,
}) => {
  const haptic = useHaptic(hapticFeedback);
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (enableHaptic && !isDisabled) {
      haptic();
    }
    onPress?.();
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onPress={handlePress}
      disabled={isDisabled}>
      <HStack space="sm" className="items-center">
        {loading && (
          <ActivityIndicator size="small" color={variant === "solid" ? "#ffffff" : undefined} />
        )}
        <ButtonText>{loading && loadingText ? loadingText : children}</ButtonText>
      </HStack>
    </Button>
  );
};

export default ButtonLoader;
