import { FC, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "tamagui";

// Components
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Search, Plus, Check, ChevronRight } from "lucide-react-native";

// Services
import { HisnMuslimDB } from "@/services/hisn-muslim-db";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Types
import type { HisnCategory, HisnSearchResult, HisnAthkar } from "@/types/hisnMuslim";

type ViewMode = "categories" | "search" | "category-detail";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const AthkarSearchSheet: FC<Props> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { addItem, isSourceAdded } = useMyAthkarStore();
  const hapticSuccess = useHaptic("success");

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HisnSearchResult[]>([]);
  const [categories, setCategories] = useState<HisnCategory[]>([]);
  const [categoryAthkar, setCategoryAthkar] = useState<HisnAthkar[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HisnCategory | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isArabic = i18n.language === "ar";

  useEffect(() => {
    if (isOpen && categories.length === 0) {
      HisnMuslimDB.getCategories().then(setCategories);
    }
  }, [isOpen, categories.length]);

  useEffect(() => {
    if (!isOpen) {
      setViewMode("categories");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedCategory(null);
    }
  }, [isOpen]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setViewMode("categories");
      return;
    }

    setViewMode("search");
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await HisnMuslimDB.search(query);
      setSearchResults(results);
    }, 300);
  }, []);

  const handleCategoryPress = useCallback(async (category: HisnCategory) => {
    setSelectedCategory(category);
    setViewMode("category-detail");
    const athkar = await HisnMuslimDB.getCategoryAthkar(category.id);
    setCategoryAthkar(athkar);
  }, []);

  const handleAdd = useCallback(
    async (athkar: { id: number; categoryId: number; repeatCount: number }) => {
      setAddingIds((prev) => new Set(prev).add(athkar.id));
      const success = await addItem(athkar.id, athkar.categoryId, athkar.repeatCount);
      if (success) {
        hapticSuccess();
      }
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(athkar.id);
        return next;
      });
    },
    [addItem, hapticSuccess]
  );

  const renderAthkarItem = (item: HisnAthkar | HisnSearchResult, categoryTitle?: string) => {
    const isAdded = isSourceAdded(item.id);
    const isAdding = addingIds.has(item.id);
    const title =
      categoryTitle ??
      ("categoryTitleAr" in item ? (isArabic ? item.categoryTitleAr : item.categoryTitleEn) : "");

    return (
      <Box
        key={item.id}
        padding="$3"
        borderRadius="$4"
        backgroundColor="$backgroundSecondary"
        marginBottom="$2">
        <VStack gap="$2">
          {title !== "" && (
            <Text size="xs" color="$typographySecondary" numberOfLines={1}>
              {title}
            </Text>
          )}
          <Text
            size="lg"
            style={{ writingDirection: "rtl" }}
            textAlign="right"
            color="$typography"
            numberOfLines={3}>
            {item.arabicText}
          </Text>
          {item.translation !== "" && (
            <Text size="sm" color="$typographySecondary" numberOfLines={2}>
              {item.translation}
            </Text>
          )}
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="xs" color="$typographySecondary">
              {t("athkar.myAthkar.repeatCount")}: {item.repeatCount}
            </Text>
            <Button
              size="sm"
              variant={isAdded ? "outline" : "solid"}
              action={isAdded ? "default" : "primary"}
              onPress={() =>
                handleAdd({
                  id: item.id,
                  categoryId: item.categoryId,
                  repeatCount: item.repeatCount,
                })
              }
              disabled={isAdded || isAdding}
              accessibilityRole="button"
              accessibilityLabel={
                isAdded ? t("athkar.myAthkar.alreadyAdded") : t("athkar.myAthkar.add")
              }>
              {isAdded ? (
                <>
                  <Icon as={Check} size="sm" color="$typographySecondary" />
                  <Button.Text color="$typographySecondary">
                    {t("athkar.myAthkar.alreadyAdded")}
                  </Button.Text>
                </>
              ) : (
                <>
                  <Icon as={Plus} size="sm" color="$typographyContrast" />
                  <Button.Text>{t("athkar.myAthkar.add")}</Button.Text>
                </>
              )}
            </Button>
          </HStack>
        </VStack>
      </Box>
    );
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[85]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack gap="$3" padding="$4" width="100%">
          {/* Search Input */}
          <HStack
            gap="$2"
            alignItems="center"
            backgroundColor="$backgroundSecondary"
            borderRadius="$4"
            paddingHorizontal="$3"
            height={44}>
            <Icon as={Search} size="sm" color="$typographySecondary" />
            <Input
              flex={1}
              placeholder={t("athkar.myAthkar.search")}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal="$0"
              accessibilityLabel={t("athkar.myAthkar.search")}
            />
          </HStack>

          {/* Back to categories */}
          {viewMode === "category-detail" && selectedCategory && (
            <Pressable
              onPress={() => setViewMode("categories")}
              accessibilityRole="button"
              accessibilityLabel="Back to categories">
              <Text size="sm" color="$primary" fontWeight="600">
                ← {t("athkar.myAthkar.categories")}
              </Text>
            </Pressable>
          )}
        </VStack>

        <ActionsheetScrollView>
          <VStack gap="$2" paddingHorizontal="$4" paddingBottom="$6">
            {/* Categories View */}
            {viewMode === "categories" &&
              categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => handleCategoryPress(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={isArabic ? cat.titleAr : cat.titleEn}>
                  <HStack
                    padding="$3"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="space-between"
                    alignItems="center"
                    marginBottom="$1">
                    <Text size="md" color="$typography" flex={1} numberOfLines={2}>
                      {isArabic ? cat.titleAr : cat.titleEn}
                    </Text>
                    <Icon as={ChevronRight} size="sm" color="$typographySecondary" />
                  </HStack>
                </Pressable>
              ))}

            {/* Search Results View */}
            {viewMode === "search" && (
              <>
                {searchResults.length === 0 && searchQuery.trim() !== "" && (
                  <Text
                    size="md"
                    color="$typographySecondary"
                    textAlign="center"
                    paddingVertical="$6">
                    {t("athkar.myAthkar.noResults")}
                  </Text>
                )}
                {searchResults.map((item) => renderAthkarItem(item))}
              </>
            )}

            {/* Category Detail View */}
            {viewMode === "category-detail" && selectedCategory && (
              <>
                <Text size="lg" fontWeight="600" color="$typography" marginBottom="$2">
                  {isArabic ? selectedCategory.titleAr : selectedCategory.titleEn}
                </Text>
                {categoryAthkar.map((item) =>
                  renderAthkarItem(
                    item,
                    isArabic ? selectedCategory.titleAr : selectedCategory.titleEn
                  )
                )}
              </>
            )}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AthkarSearchSheet;
