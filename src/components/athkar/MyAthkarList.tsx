import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Button, ButtonIcon } from "@/components/ui/button";

// Icons
import { Plus } from "lucide-react-native";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Hooks
import { useInitializeMyAthkar } from "@/hooks/useInitializeMyAthkar";

// Components
import MyAthkarCard from "@/components/athkar/MyAthkarCard";
import MyAthkarEmpty from "@/components/athkar/MyAthkarEmpty";
import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";
import AthkarDetailSheet from "@/components/athkar/AthkarDetailSheet";

const MyAthkarList: FC = () => {
  const { t, i18n } = useTranslation();
  const { isInitialized } = useInitializeMyAthkar();
  const items = useMyAthkarStore((s) => s.items);
  const displayData = useMyAthkarStore((s) => s.displayData);
  const progress = useMyAthkarStore((s) => s.progress);
  const removeItem = useMyAthkarStore((s) => s.removeItem);

  const [showSearch, setShowSearch] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const isArabic = i18n.language === "ar";

  const handleCardPress = useCallback((myAthkarId: number) => {
    setSelectedItemId(myAthkarId);
    setShowDetail(true);
  }, []);

  const handleRemove = useCallback(
    async (myAthkarId: number) => {
      await removeItem(myAthkarId);
    },
    [removeItem]
  );

  if (!isInitialized) {
    return (
      <Box padding="$4">
        <Text color="$typographySecondary">{t("athkar.loading.initializing")}</Text>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <MyAthkarEmpty onOpenSearch={() => setShowSearch(true)} />
        <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />
      </>
    );
  }

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const selectedDisplay = selectedItem ? displayData.get(selectedItem.sourceAthkarId) : null;
  const selectedProgress = selectedItemId
    ? (progress.find((p) => p.myAthkarId === selectedItemId) ?? null)
    : null;

  return (
    <>
      {/* Header — just the add button */}
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

      {/* List — swipeable cards */}
      <VStack gap="$3">
        {items.map((item) => {
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

      {/* Sheets */}
      <AthkarSearchSheet isOpen={showSearch} onClose={() => setShowSearch(false)} />

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
    </>
  );
};

export default MyAthkarList;
