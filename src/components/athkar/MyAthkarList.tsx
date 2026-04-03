import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { Plus, ChevronRight, ChevronLeft } from "lucide-react-native";

import { useMyAthkarStore } from "@/stores/my-athkar";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useInitializeMyAthkar } from "@/hooks/useInitializeMyAthkar";
import { useInitializeCustomAthkar } from "@/hooks/useInitializeCustomAthkar";

import MyAthkarEmpty from "@/components/athkar/MyAthkarEmpty";
import MyAthkarCategoryDetail from "@/components/athkar/MyAthkarCategoryDetail";
import CustomAthkarDetail from "@/components/athkar/CustomAthkarDetail";
import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";

import type { MyAthkarCategoryGroup } from "@/types/hisnMuslim";
import type { CustomAthkarGroup } from "@/types/athkar";

type SelectedGroup =
  | { type: "hisn"; group: MyAthkarCategoryGroup }
  | { type: "custom"; group: CustomAthkarGroup }
  | null;

const MyAthkarList: FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const { isInitialized: hisnInitialized } = useInitializeMyAthkar();
  const { isInitialized: customInitialized } = useInitializeCustomAthkar();

  const getGroupedByCategory = useMyAthkarStore((s) => s.getGroupedByCategory);
  const hisnItems = useMyAthkarStore((s) => s.items);
  const hisnProgress = useMyAthkarStore((s) => s.progress);

  const customGroups = useCustomAthkarStore((s) => s.groups);
  const getGroupItems = useCustomAthkarStore((s) => s.getGroupItems);
  const getGroupProgress = useCustomAthkarStore((s) => s.getGroupProgress);

  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup>(null);

  const isArabic = i18n.language === "ar";
  const isRTL = i18n.dir() === "rtl";

  const handleBack = useCallback(() => setSelectedGroup(null), []);

  if (!hisnInitialized || !customInitialized) {
    return (
      <Box padding="$4">
        <Text color="$typographySecondary">{t("athkar.loading.initializing")}</Text>
      </Box>
    );
  }

  // Detail views
  if (selectedGroup?.type === "hisn") {
    return (
      <MyAthkarCategoryDetail
        group={selectedGroup.group}
        onBack={handleBack}
        onOpenSearch={() => setShowSearch(true)}
        showSearch={showSearch}
        onCloseSearch={() => setShowSearch(false)}
      />
    );
  }

  if (selectedGroup?.type === "custom") {
    return <CustomAthkarDetail group={selectedGroup.group} onBack={handleBack} />;
  }

  const isEmpty = hisnItems.length === 0 && customGroups.length === 0;

  if (isEmpty) {
    return (
      <>
        <MyAthkarEmpty onOpenSearch={() => setShowSearch(true)} />
        {showSearch && (
          <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />
        )}
      </>
    );
  }

  const hisnGroups = getGroupedByCategory();

  return (
    <>
      {/* Header */}
      <HStack justifyContent="flex-start" alignItems="center" gap="$2" marginBottom="$3">
        <Button
          size="sm"
          variant="solid"
          action="primary"
          onPress={() => setShowSearch(true)}
          accessibilityRole="button"
          accessibilityLabel={t("athkar.myAthkar.add")}>
          <ButtonIcon as={Plus} />
          <Button.Text>{t("athkar.myAthkar.add")}</Button.Text>
        </Button>

        <Button
          size="sm"
          variant="outline"
          action="primary"
          onPress={() => router.push("/custom-athkar/new")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.customAthkar.createButton")}>
          <ButtonIcon as={Plus} />
          <Button.Text>{t("athkar.customAthkar.create")}</Button.Text>
        </Button>
      </HStack>

      <VStack gap="$3">
        {/* Hisn Muslim Groups */}
        {hisnGroups.map((group) => {
          const completedCount = group.items.filter((item) => {
            const prog = hisnProgress.find((p) => p.myAthkarId === item.id);
            return prog?.completed;
          }).length;

          return (
            <Pressable
              key={group.categoryId}
              onPress={() => setSelectedGroup({ type: "hisn", group })}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? group.titleAr : group.titleEn}>
              <Box padding="$4" borderRadius="$6" backgroundColor="$backgroundSecondary">
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack flex={1} gap="$1">
                    <Text size="lg" fontWeight="600" color="$typography" numberOfLines={2}>
                      {isArabic ? group.titleAr : group.titleEn}
                    </Text>
                    <Text size="sm" color="$typographySecondary">
                      {completedCount}/{group.items.length} {t("athkar.todayProgress")}
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

        {/* Custom Groups */}
        {customGroups.map((group) => {
          const items = getGroupItems(group.id);
          const progressList = getGroupProgress(group.id);
          const completedCount = progressList.filter((p) => p.completed).length;

          return (
            <Pressable
              key={`custom-${group.id}`}
              onPress={() => setSelectedGroup({ type: "custom", group })}
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

      {showSearch && <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />}
    </>
  );
};

export default MyAthkarList;
