import React from "react";
import { ActivityIndicator } from "react-native";

// Components
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useTheme } from "tamagui";

// Types
type HapticType = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

type Props = {
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "link";
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
  loadingText,
  hapticFeedback = "selection",
  enableHaptic = true,
}) => {
  const haptic = useHaptic(hapticFeedback);
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (enableHaptic && !isDisabled) {
      haptic();
    }
    onPress?.();
  };

  return (
    <Button size={size} variant={variant} onPress={handlePress} disabled={isDisabled}>
      <HStack gap="$2" alignItems="center">
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === "solid" ? theme.typographyContrast.val : theme.primary.val}
          />
        )}
        <Button.Text>{loading && loadingText ? loadingText : children}</Button.Text>
      </HStack>
    </Button>
  );
};

export default ButtonLoader;
