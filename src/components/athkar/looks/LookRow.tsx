import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { LookPicture } from "@/components/athkar/looks/LookPreview";
import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useRTL } from "@/contexts/RTLContext";
import { useAthkarLookId } from "@/hooks/useAthkarLook";

/** The settings row for the look in use: its picture and name; opens the chooser. */
export const LookRow = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const look = useAthkarLookId();
  const name = t(ATHKAR_LOOKS[look].name);

  return (
    <Card.Pressable
      onPress={() => router.push(BACK_DESTINATION.SETTINGS_ATHKAR_LOOK.href)}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.join", { first: t("athkar.look.title"), second: name })}
      accessibilityHint={t("a11y.athkar.lookRowHint")}>
      <HStack alignItems="center" gap="$3">
        <LookPicture look={look} />
        <VStack flex={1} gap="$1">
          <Text fontWeight="500" color="$typography">
            {t("athkar.look.title")}
          </Text>
          <Text size="sm" color="$typographySecondary">
            {name}
          </Text>
        </VStack>
        <Icon
          as={ChevronRight}
          size="md"
          color="$typographySecondary"
          style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
        />
      </HStack>
    </Card.Pressable>
  );
};
