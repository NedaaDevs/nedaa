import { FC } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

import { ChevronRight, ChevronLeft } from "lucide-react-native";

import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useInitializeCustomAthkar } from "@/hooks/useInitializeCustomAthkar";

import type { CustomAthkarGroup } from "@/types/athkar";

type Props = {
  selectedGroup: CustomAthkarGroup | null;
  onSelectGroup: (group: CustomAthkarGroup | null) => void;
};

const CustomAthkarList: FC<Props> = ({ selectedGroup: _selectedGroup, onSelectGroup }) => {
  const { t, i18n } = useTranslation();

  useInitializeCustomAthkar();

  const groups = useCustomAthkarStore((s) => s.groups);
  const getGroupItems = useCustomAthkarStore((s) => s.getGroupItems);
  const getGroupProgress = useCustomAthkarStore((s) => s.getGroupProgress);

  const isRTL = i18n.dir() === "rtl";

  if (groups.length === 0) return null;

  return (
    <VStack gap="$3">
      {groups.map((group) => {
        const items = getGroupItems(group.id);
        const progressList = getGroupProgress(group.id);
        const completedCount = progressList.filter((p) => p.completed).length;

        return (
          <Pressable
            key={group.id}
            onPress={() => onSelectGroup(group)}
            accessibilityRole="button"
            accessibilityLabel={group.title}>
            <Box padding="$4" borderRadius="$6" backgroundColor="$backgroundSecondary">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1} gap="$1">
                  <Text size="lg" fontWeight="600" color="$typography" numberOfLines={2}>
                    {group.title}
                  </Text>
                  <Text size="sm" color="$typographySecondary">
                    {completedCount}/{items.length} {t("athkar.todayProgress")}
                  </Text>
                </VStack>
                <Icon
                  as={isRTL ? ChevronLeft : ChevronRight}
                  size="md"
                  color="$typographySecondary"
                />
              </HStack>
            </Box>
          </Pressable>
        );
      })}
    </VStack>
  );
};

export default CustomAthkarList;
