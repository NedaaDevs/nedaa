import { useTranslation } from "react-i18next";
import { Link } from "expo-router";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import type { LucideIcon } from "lucide-react-native";

type Props = {
  titleKey: string;
  subtitleKey: string;
  icon: LucideIcon;
  href: string;
};

const PrepareCard = ({ titleKey, subtitleKey, icon: IconComponent, href }: Props) => {
  const { t } = useTranslation();

  return (
    <Link href={href as any} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("a11y.umrah.prepareCard", { title: t(titleKey) })}>
        <Box
          width={140}
          padding="$3"
          borderRadius="$3"
          backgroundColor="$backgroundSecondary"
          style={{ borderCurve: "continuous" }}
          gap="$2">
          <Box
            width={36}
            height={36}
            borderRadius={18}
            borderWidth={1.5}
            borderColor="$accentPrimary"
            backgroundColor="$background"
            alignItems="center"
            justifyContent="center">
            <Icon as={IconComponent} size="sm" color="$accentPrimary" />
          </Box>
          <VStack gap="$1">
            <Text size="sm" fontWeight="600" color="$typography" numberOfLines={1}>
              {t(titleKey)}
            </Text>
            <Text size="xs" color="$typographySecondary" numberOfLines={2}>
              {t(subtitleKey)}
            </Text>
          </VStack>
        </Box>
      </Pressable>
    </Link>
  );
};

export default PrepareCard;
