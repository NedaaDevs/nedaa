import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { ChevronRight, ChevronLeft } from "lucide-react-native";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Components
import MyAthkarCard from "@/components/athkar/MyAthkarCard";
import AthkarDetailSheet from "@/components/athkar/AthkarDetailSheet";
import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";

// Types
import type { MyAthkarCategoryGroup } from "@/types/hisnMuslim";

type Props = {
  group: MyAthkarCategoryGroup;
  onBack: () => void;
  onOpenSearch: () => void;
  showSearch: boolean;
  onCloseSearch: () => void;
};

const MyAthkarCategoryDetail: FC<Props> = ({
  group,
  onBack,
  onOpenSearch,
  showSearch,
  onCloseSearch,
}) => {
  const { t, i18n } = useTranslation();
  const displayData = useMyAthkarStore((s) => s.displayData);
  const progress = useMyAthkarStore((s) => s.progress);
  const removeItem = useMyAthkarStore((s) => s.removeItem);

  const [showDetail, setShowDetail] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const isArabic = i18n.language === "ar";
  const isRTL = i18n.dir() === "rtl";

  const handleCardPress = useCallback((myAthkarId: number) => {
    setSelectedItemId(myAthkarId);
    setShowDetail(true);
  }, []);

  const handleRemove = useCallback(
    async (myAthkarId: number) => {
      await removeItem(myAthkarId);
      // If this was the last item in the group, go back
      if (group.items.length <= 1) {
        onBack();
      }
    },
    [removeItem, group.items.length, onBack]
  );

  const selectedItem = selectedItemId ? group.items.find((i) => i.id === selectedItemId) : null;
  const selectedDisplay = selectedItem ? displayData.get(selectedItem.sourceAthkarId) : null;
  const selectedProgress = selectedItemId
    ? (progress.find((p) => p.myAthkarId === selectedItemId) ?? null)
    : null;

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* Header */}
      <VStack gap="$3" marginBottom="$3">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("athkar.myAthkar.categories")}>
          <HStack gap="$1" alignItems="center">
            <Icon as={BackIcon} size="sm" color="$primary" />
            <Text size="sm" color="$primary" fontWeight="600">
              {t("athkar.myAthkar")}
            </Text>
          </HStack>
        </Pressable>
        <Text size="xl" fontWeight="700" color="$typography">
          {isArabic ? group.titleAr : group.titleEn}
        </Text>
      </VStack>

      {/* Athkar Cards */}
      <VStack gap="$3">
        {group.items.map((item) => {
          const display = displayData.get(item.sourceAthkarId);
          const prog = progress.find((p) => p.myAthkarId === item.id);

          if (!display || !prog) return null;

          return (
            <MyAthkarCard
              key={item.id}
              myAthkarId={item.id}
              arabicText={display.arabicText}
              categoryTitle={isArabic ? display.categoryTitleAr : display.categoryTitleEn}
              progress={prog}
              onPress={() => handleCardPress(item.id)}
            />
          );
        })}
      </VStack>

      {/* Detail Sheet */}
      <AthkarDetailSheet
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        myAthkarId={selectedItemId}
        arabicText={selectedDisplay?.arabicText ?? ""}
        transliteration={selectedDisplay?.transliteration ?? ""}
        translation={selectedDisplay?.translation ?? ""}
        categoryTitle={
          selectedDisplay
            ? isArabic
              ? selectedDisplay.categoryTitleAr
              : selectedDisplay.categoryTitleEn
            : ""
        }
        progress={selectedProgress}
        onRemove={handleRemove}
      />

      {/* Search Sheet */}
      <AthkarSearchSheet isOpen={showSearch} onClose={onCloseSearch} />
    </>
  );
};

export default MyAthkarCategoryDetail;
