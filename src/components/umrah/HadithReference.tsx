import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useHaptic } from "@/hooks/useHaptic";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react-native";

type Props = {
  hadithSource: string;
  hadithTranslation?: string;
};

const HadithReference = ({ hadithSource, hadithTranslation }: Props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const selectionHaptic = useHaptic("selection");

  const handleToggle = async () => {
    await selectionHaptic();
    setExpanded((prev) => !prev);
  };

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel={`${t("umrah.hadithSource")}: ${hadithTranslation || hadithSource}`}
      accessibilityHint={t("a11y.umrah.expandSourceHint")}
      accessibilityState={{ expanded }}>
      <Box
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        borderRadius="$2"
        backgroundColor="$backgroundSecondary"
        style={{ borderCurve: "continuous", minHeight: 44 }}>
        <HStack alignItems="center" gap="$2">
          <Icon as={BookOpen} size="xs" color="$typographySecondary" />
          <Text size="xs" color="$typographySecondary" flex={1}>
            {t("umrah.hadithSource")}
          </Text>
          <Icon as={expanded ? ChevronUp : ChevronDown} size="xs" color="$typographySecondary" />
        </HStack>

        {expanded && (
          <VStack gap="$1" paddingTop="$2">
            <Text size="xs" color="$typography" selectable>
              {hadithSource}
            </Text>
            {hadithTranslation && hadithTranslation !== hadithSource && (
              <Text size="xs" color="$typographySecondary" selectable>
                {hadithTranslation}
              </Text>
            )}
          </VStack>
        )}
      </Box>
    </Pressable>
  );
};

export default HadithReference;
