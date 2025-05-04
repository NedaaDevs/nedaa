// Plugins
import { useTranslation } from "react-i18next";
import { Link } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { Settings } from "lucide-react-native";

const TopBar = () => {
  const { t } = useTranslation();
  return (
    <Box className="px-4 py-3 flex flex-row items-center justify-between bg-background">
      <Box className="flex-1 items-start">
        <Link href="/settings" asChild>
          <Pressable>
            <Icon as={Settings} size="md" color="white" />
          </Pressable>
        </Link>
      </Box>
      <Box className="flex-1 items-center">
        <Text className="text-xl font-bold text-white ">{t("nedaa")}</Text>
      </Box>
      <Box className="flex-1 items-end" />
    </Box>
  );
};

export default TopBar;
