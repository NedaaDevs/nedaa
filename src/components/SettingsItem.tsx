// Plugins
import { Link } from "expo-router";
import { I18nManager } from "react-native";

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
};

const SettingsItem = ({ name, path, icon, rtl = I18nManager.isRTL }: Props) => {
  const ChevronIcon = rtl ? ChevronLeft : ChevronRight;

  return (
    <Box className="relative inset-0 m-2 p-5 rounded-lg overflow-hidden dark:bg-gray-800 bg-white border border-gray-200 dark:border-gray-700">
      <Link href={path} asChild>
        <Pressable className="flex-row items-center">
          <HStack className="justify-between items-center relative z-10 w-full">
            <HStack className="items-center">
              {icon && (
                <Box className="mr-6">
                  <Icon
                    className="font-bold text-typography dark:text-tertiary"
                    size="lg"
                    as={icon}></Icon>
                </Box>
              )}
              <Text className="text-xl font-medium text-primary dark:text-secondary">{name}</Text>
            </HStack>

            <Icon size="xl" className="text-gray-400" as={ChevronIcon} />
          </HStack>
        </Pressable>
      </Link>
    </Box>
  );
};

export default SettingsItem;
