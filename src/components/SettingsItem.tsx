// Plugins
import { Link } from "expo-router";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { ChevronRight, ChevronLeft } from "lucide-react-native";

// Types
import type { Href } from "expo-router";

type Props = {
  name: string;
  path: Href;
  icon?: any;
  rtl?: boolean;
  currentValue?: string;
};

const SettingsItem = ({ name, path, icon, currentValue, rtl }: Props) => {
  const { isRTL } = useRTL();
  const effectiveRTL = rtl !== undefined ? rtl : isRTL;
  const ChevronIcon = effectiveRTL ? ChevronLeft : ChevronRight;

  return (
    <Box margin="$2" padding="$5" borderRadius="$4" backgroundColor="$backgroundSecondary">
      <Link href={path} asChild>
        <Pressable flexDirection="row" alignItems="center">
          <HStack justifyContent="space-between" alignItems="center" zIndex={10} width="100%">
            <HStack alignItems="center">
              {icon && (
                <Box marginEnd="$6">
                  <Icon color="$typography" size="lg" as={icon} />
                </Box>
              )}
              <Text size="xl" fontWeight="500" color="$typography">
                {name}
              </Text>
            </HStack>

            <HStack alignItems="center">
              {currentValue && (
                <Text size="lg" color="$typographySecondary" marginEnd="$2">
                  {currentValue}
                </Text>
              )}
              <Icon size="xl" color="$typographySecondary" as={ChevronIcon} />
            </HStack>
          </HStack>
        </Pressable>
      </Link>
    </Box>
  );
};

export default SettingsItem;
