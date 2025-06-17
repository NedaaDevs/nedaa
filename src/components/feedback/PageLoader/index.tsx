import React from "react";
import { ActivityIndicator } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";

// Types
type Props = {
  loading?: boolean;
  children: React.ReactNode;
  message?: string;
  size?: "small" | "large";
  minHeight?: number;
  showMessage?: boolean;
};

export const PageLoader: React.FC<Props> = ({
  loading = false,
  children,
  message,
  size = "large",
  minHeight = 200,
  showMessage = true,
}) => {
  if (loading) {
    return (
      <Box className="flex-1 items-center justify-center" style={{ minHeight }}>
        <VStack space="md" className="items-center">
          <ActivityIndicator size={size} className="text-accent-primary" />
          {showMessage && message && (
            <Text className="text-sm text-typography-secondary text-center">{message}</Text>
          )}
        </VStack>
      </Box>
    );
  }

  return <>{children}</>;
};

export default PageLoader;
