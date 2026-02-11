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
    <Box className="relative inset-0 m-2 p-5 rounded-lg overflow-hidden bg-background-secondary">
      <Link href={path} asChild>
        <Pressable className="flex-row items-center">
          <HStack className="justify-between items-center relative z-10 w-full">
            <HStack className="items-center">
              {icon && (
                <Box className="me-6">
                  <Icon className="font-bold text-typography" size="lg" as={icon}></Icon>
                </Box>
              )}
              <Text className="text-xl font-medium text-typography">{name}</Text>
            </HStack>

            <HStack className="items-center">
              {currentValue && (
                <Text className="text-lg text-typography-secondary me-2">{currentValue}</Text>
              )}
              <Icon size="xl" className="text-typography-secondary" as={ChevronIcon} />
            </HStack>
          </HStack>
        </Pressable>
      </Link>
    </Box>
  );
};

export default SettingsItem;
