import { useTranslation } from "react-i18next";
import { MotiView } from "moti";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Check } from "lucide-react-native";

type Props = {
  items: string[];
  checklistState: Record<string, boolean>;
  onToggle: (item: string) => void;
};

const StageChecklist = ({ items, checklistState, onToggle }: Props) => {
  const { t } = useTranslation();

  return (
    <VStack gap="$2" paddingHorizontal="$4">
      {items.map((item) => {
        const checked = !!checklistState[item];
        return (
          <Pressable
            key={item}
            onPress={() => onToggle(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={t(item)}>
            <HStack
              gap="$3"
              alignItems="center"
              padding="$3"
              borderRadius="$3"
              backgroundColor="$backgroundSecondary">
              <Box
                width={28}
                height={28}
                borderRadius={14}
                borderWidth={2}
                borderColor={checked ? "$accentPrimary" : "$outline"}
                backgroundColor={checked ? "$accentPrimary" : "transparent"}
                alignItems="center"
                justifyContent="center">
                {checked && (
                  <MotiView
                    from={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "timing", duration: 200 }}>
                    <Icon as={Check} size="xs" color="white" />
                  </MotiView>
                )}
              </Box>
              <Text
                flex={1}
                size="md"
                color={checked ? "$typographySecondary" : "$typography"}
                textDecorationLine={checked ? "line-through" : "none"}>
                {t(item)}
              </Text>
            </HStack>
          </Pressable>
        );
      })}
    </VStack>
  );
};

export default StageChecklist;
