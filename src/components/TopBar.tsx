// Components
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Settings } from "lucide-react-native";

// Plugins
import { useTranslation } from "react-i18next";

const TopBar = () => {
  const { t } = useTranslation();
  return (
    <Box className="px-4 py-3 flex flex-row items-center justify-between bg-background">
      <Box className="flex-1 items-start">
        <Icon as={Settings} size="md" color="white" />
      </Box>
      <Box className="flex-1 items-center">
        <Text className="text-xl font-bold text-white ">{t("nedaa")}</Text>
      </Box>
      <Box className="flex-1 items-end" />
    </Box>
  );
};

export default TopBar;
