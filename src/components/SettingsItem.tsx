// Plugins
import { Link } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Types
import type { Href } from "expo-router";

type Props = {
  name: string;
  path: Href;
  icon?: any;
};

const SettingsItem = ({ name, path, icon }: Props) => (
  <Box className="relative inset-0 m-2 p-4 rounded-lg overflow-hidden dark:bg-gray-800 bg-white border border-gray-200 dark:border-gray-700">
    <Link href={path} asChild>
      <Pressable className="flex-row items-center space-x-2">
        <HStack className="justify-between items-center relative z-10">
          <HStack className="items-center space-x-3">
            {icon && (
              <Icon className="font-bold text-typography dark:text-tertiary mr-5" as={icon}></Icon>
            )}
            <Text className="mx-2 text-lg font-medium text-primary dark:text-secondary">
              {name}
            </Text>
          </HStack>
        </HStack>
      </Pressable>
    </Link>
  </Box>
);

export default SettingsItem;
