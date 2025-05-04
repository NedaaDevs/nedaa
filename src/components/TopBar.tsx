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
    <Box className="px-4 py-3 flex flex-row items-center bg-primary">
      <Box className="w-10">
        {backOnClick && (
          <Pressable onPress={handlePress}>
            <Icon as={BackArrow} size="md" color="white" />
          </Pressable>
        )}
      </Box>

      <Box className="flex-1 items-center">
        <Text className="text-xl font-bold text-white">{t(title)}</Text>
      </Box>

      <Box className="w-10 items-end">
        {!backOnClick && (
          <Link href={href} asChild>
            <Pressable>
              <Icon as={icon} size="md" color="white" />
            </Pressable>
          </Link>
        )}
      </Box>
    </Box>
  );
};

export default TopBar;
