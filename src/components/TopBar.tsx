// Plugins
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "expo-router";
import { I18nManager } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { ArrowLeft, ArrowRight } from "lucide-react-native";

// Types
import type { Href } from "expo-router";

type Props = {
  href: Href;
  title: string;
  icon?: any;
  backOnClick?: boolean;
};

const TopBar = ({ href, title, icon, backOnClick = false }: Props) => {
  const router = useRouter();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  // Determine which arrow to show based on RTL/LTR
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const handlePress = () => {
    if (backOnClick) {
      router.back();
    }
  };

  return (
    <Box className="px-5 py-4 flex flex-row items-center bg-secondary dark:bg-background-elevated">
      <Box className="flex-1 flex-row items-center gap-3">
        {backOnClick && (
          <Pressable onPress={handlePress} className="p-2 rounded-lg ">
            <Icon as={BackArrow} size="lg" className="text-white dark:text-typography" />
          </Pressable>
        )}
        <Text className="text-2xl font-bold text-white dark:text-typography">{t(title)}</Text>
      </Box>

      <Box className="w-12 items-end">
        {!backOnClick && (
          <Link href={href} asChild>
            <Pressable className="p-2 rounded-lg">
              <Icon as={icon} size="lg" className="text-white dark:text-typography" />
            </Pressable>
          </Link>
        )}
      </Box>
    </Box>
  );
};

export default TopBar;
