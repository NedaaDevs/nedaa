import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Plus, ChevronRight, ChevronLeft } from "lucide-react-native";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Hooks
import { useInitializeMyAthkar } from "@/hooks/useInitializeMyAthkar";

// Components
import MyAthkarEmpty from "@/components/athkar/MyAthkarEmpty";
import MyAthkarCategoryDetail from "@/components/athkar/MyAthkarCategoryDetail";
import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";

// Types
import type { MyAthkarCategoryGroup } from "@/types/hisnMuslim";

const MyAthkarList: FC = () => {
  const { t, i18n } = useTranslation();
  const { isInitialized } = useInitializeMyAthkar();
  const getGroupedByCategory = useMyAthkarStore((s) => s.getGroupedByCategory);
  const items = useMyAthkarStore((s) => s.items);
  const progress = useMyAthkarStore((s) => s.progress);

  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MyAthkarCategoryGroup | null>(null);

  const isArabic = i18n.language === "ar";
  const isRTL = i18n.dir() === "rtl";

  const handleCategoryPress = useCallback((group: MyAthkarCategoryGroup) => {
    setSelectedGroup(group);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGroup(null);
  }, []);

  if (!isInitialized) {
    return (
      <Box padding="$4">
        <Text color="$typographySecondary">{t("athkar.loading.initializing")}</Text>
      </Box>
    );
  }

  if (items.length === 0 && !selectedGroup) {
    return (
      <>
        <MyAthkarEmpty onOpenSearch={() => setShowSearch(true)} />
        {showSearch && (
          <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />
        )}
      </>
    );
  }

  // Category detail view
  if (selectedGroup) {
    return (
      <MyAthkarCategoryDetail
        group={selectedGroup}
        onBack={handleBack}
        onOpenSearch={() => setShowSearch(true)}
        showSearch={showSearch}
        onCloseSearch={() => setShowSearch(false)}
      />
    );
  }

  // Category cards view
  const groups = getGroupedByCategory();

  return (
    <>
      {/* Header */}
      <HStack justifyContent="flex-end" alignItems="center" marginBottom="$3">
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
      </HStack>

      {/* Category Cards */}
      <VStack gap="$3">
        {groups.map((group) => {
          const completedCount = group.items.filter((item) => {
            const prog = progress.find((p) => p.myAthkarId === item.id);
            return prog?.completed;
          }).length;

          return (
            <Pressable
              key={group.categoryId}
              onPress={() => handleCategoryPress(group)}
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
      </VStack>

      {/* Search Sheet — only mount when open */}
      {showSearch && <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />}
    </>
  );
};

export default MyAthkarList;
