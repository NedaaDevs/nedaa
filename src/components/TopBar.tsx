// Plugins
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "expo-router";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

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
  href?: Href;
  title: string;
  icon?: any;
  backOnClick?: boolean;
};

const TopBar = ({ href, title, icon, backOnClick = false }: Props) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useRTL();

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const handlePress = () => {
    if (backOnClick) {
      router.back();
    }
  };

  return (
    <Box
      paddingHorizontal="$5"
      paddingVertical="$4"
      flexDirection="row"
      alignItems="center"
      backgroundColor="$backgroundElevated">
      <Box flex={1} flexDirection="row" alignItems="center" gap="$3">
        {backOnClick && (
          <Pressable
            onPress={handlePress}
            padding="$2"
            borderRadius="$4"
            minHeight={44}
            minWidth={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Icon as={BackArrow} size="lg" color="$typographyContrast" />
          </Pressable>
        )}
        <Text size="2xl" bold color="$typographyContrast">
          {t(title)}
        </Text>
      </Box>

      <Box width={48} alignItems="flex-end">
        {href && !backOnClick && (
          <Link href={href} asChild>
            <Pressable
              padding="$2"
              borderRadius="$4"
              minHeight={44}
              minWidth={44}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button">
              <Icon as={icon} size="lg" color="$typographyContrast" />
            </Pressable>
          </Link>
        )}
      </Box>
    </Box>
  );
};

export default TopBar;
