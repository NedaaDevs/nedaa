import { FC, useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

import { ChevronRight, ChevronLeft, Pencil } from "lucide-react-native";

import { useCustomAthkarStore } from "@/stores/custom-athkar";
import CustomAthkarCard from "@/components/athkar/CustomAthkarCard";
import LongPressHint from "@/components/athkar/LongPressHint";

import type { CustomAthkarGroup } from "@/types/athkar";

type Props = {
  group: CustomAthkarGroup;
  onBack: () => void;
};

const CustomAthkarDetail: FC<Props> = ({ group, onBack }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const allItems = useCustomAthkarStore((s) => s.items);
  const allProgress = useCustomAthkarStore((s) => s.progress);

  const isRTL = i18n.dir() === "rtl";
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const items = useMemo(() => allItems.filter((i) => i.groupId === group.id), [allItems, group.id]);
  const progressList = useMemo(() => {
    const itemIds = new Set(items.map((i) => i.id));
    return allProgress.filter((p) => itemIds.has(p.customItemId));
  }, [items, allProgress]);

  return (
    <>
      {/* Header */}
      <VStack gap="$3" marginBottom="$3">
        <HStack justifyContent="space-between" alignItems="center">
          <Pressable
            onPress={onBack}
            minHeight={44}
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("athkar.myAthkar")}>
            <HStack gap="$1" alignItems="center">
              <Icon as={BackIcon} size="sm" color="$primary" />
              <Text size="sm" color="$primary" fontWeight="600">
                {t("athkar.myAthkar")}
              </Text>
            </HStack>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/custom-athkar/${group.id}`)}
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.customAthkar.editGroup")}>
            <Icon as={Pencil} size="sm" color="$typographySecondary" />
          </Pressable>
        </HStack>

        <Text size="xl" fontWeight="700" color="$typography" textAlign="left">
          {group.title}
        </Text>
      </VStack>

      {/* Long-press hint */}
      <VStack marginBottom="$3">
        <LongPressHint />
      </VStack>

      {/* Thikir Cards */}
      <VStack gap="$3">
        {items.map((item) => {
          const prog = progressList.find((p) => p.customItemId === item.id);
          if (!prog) return null;
          return (
            <CustomAthkarCard
              key={item.id}
              customItemId={item.id}
              arabicText={item.arabicText}
              progress={prog}
            />
          );
        })}
      </VStack>
    </>
  );
};

export default CustomAthkarDetail;
