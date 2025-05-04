// Plugins
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";

type Props = {
  // TODO: Add type for href
  href: "/settings" | "/";
  title: string;
  icon: any;
  backOnClick?: boolean;
};

const TopBar = ({ href, title, icon, backOnClick = false }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handlePress = () => {
    if (backOnClick) {
      router.back();
    }
  };

  return (
    <Box className="px-4 py-3 flex flex-row items-center justify-between bg-background">
      <Box className="flex-1 items-start">
        <Pressable onPress={handlePress}>
          {backOnClick ? (
            <Icon as={icon} size="md" color="white" />
          ) : (
            <Link href={href} asChild>
              <Pressable>
                <Icon as={icon} size="md" color="white" />
              </Pressable>
            </Link>
          )}
        </Pressable>
      </Box>
      <Box className="flex-1 items-center">
        <Text className="text-xl font-bold text-white">{title}</Text>
      </Box>
      <Box className="flex-1 items-end" />
    </Box>
  );
};

export default TopBar;
