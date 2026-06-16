// Plugins
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "expo-router";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
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
  rightIconLabel?: string;
  // TODO(quran-gate): remove at 2.10.0
  onTitlePress?: () => void;
};

const TopBar = ({
  href,
  title,
  icon,
  backOnClick = false,
  rightIconLabel,
  onTitlePress,
}: Props) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useRTL();

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const handlePress = () => {
    if (backOnClick && href) {
      router.navigate(href);
    } else if (backOnClick) {
      router.back();
    }
  };

  return (
    <Box paddingHorizontal="$5" paddingVertical="$4" backgroundColor="$backgroundElevated">
      <HStack justifyContent="space-between" alignItems="center" width="100%">
        <HStack alignItems="center" gap="$3" flexShrink={1}>
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
              accessibilityLabel={t("a11y.back")}>
              <Icon as={BackArrow} size="lg" color="$typographyContrast" />
            </Pressable>
          )}

          {onTitlePress ? (
            // TODO(quran-gate): remove onTitlePress wrapper at 2.10.0
            <Pressable onPress={onTitlePress} accessible={false} flexShrink={1}>
              <Text size="2xl" bold color="$typographyContrast" accessibilityRole="header">
                {t(title)}
              </Text>
            </Pressable>
          ) : (
            <Text size="2xl" bold color="$typographyContrast" accessibilityRole="header">
              {t(title)}
            </Text>
          )}
        </HStack>

        {href && !backOnClick && (
          <Link href={href} asChild>
            <Pressable
              padding="$2"
              borderRadius="$4"
              minHeight={44}
              minWidth={44}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel}>
              <Icon as={icon} size="lg" color="$typographyContrast" />
            </Pressable>
          </Link>
        )}
      </HStack>
    </Box>
  );
};

export default TopBar;
