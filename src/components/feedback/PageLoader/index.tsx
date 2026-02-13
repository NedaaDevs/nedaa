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
      <Box flex={1} alignItems="center" justifyContent="center" minHeight={minHeight}>
        <VStack gap="$3" alignItems="center">
          <ActivityIndicator size={size} />
          {showMessage && message && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {message}
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  return <>{children}</>;
};

export default PageLoader;
