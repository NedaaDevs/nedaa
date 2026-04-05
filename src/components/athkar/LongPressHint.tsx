import { FC } from "react";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

import { Lightbulb } from "lucide-react-native";

const LongPressHint: FC = () => {
  const { t } = useTranslation();

  return (
    <HStack
      gap="$2"
      alignItems="center"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      backgroundColor="$backgroundMuted"
      accessibilityRole="text">
      <Icon as={Lightbulb} size="xs" color="$typographySecondary" />
      <Text size="xs" color="$typographySecondary" flex={1}>
        {t("athkar.hints.longPressToTen")}
      </Text>
    </HStack>
  );
};

export default LongPressHint;
