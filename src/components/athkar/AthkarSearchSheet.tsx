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
import { Icon } from "@/components/ui/icon";

// Icons
import { Search, ChevronRight, ChevronLeft, Check, Square, CheckSquare } from "lucide-react-native";

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
  const hapticSelection = useHaptic("selection");

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HisnSearchResult[]>([]);
  const [categories, setCategories] = useState<HisnCategory[]>([]);
  const [categoryAthkar, setCategoryAthkar] = useState<HisnAthkar[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HisnCategory | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isArabic = i18n.language === "ar";
  const isRTL = i18n.dir() === "rtl";

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

  const handleToggleItem = useCallback(
    async (item: HisnAthkar) => {
      const isAdded = isSourceAdded(item.id);
      if (isAdded) return;

      setAddingIds((prev) => new Set(prev).add(item.id));
      hapticSelection();
      const success = await addItem(item.id, item.categoryId, item.repeatCount);
      if (success) {
        hapticSuccess();
      }
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    },
    [addItem, isSourceAdded, hapticSelection, hapticSuccess]
  );

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const renderAthkarCheckItem = (item: HisnAthkar) => {
    const isAdded = isSourceAdded(item.id);
    const isAdding = addingIds.has(item.id);

    return (
      <Pressable
        key={item.id}
        onPress={() => handleToggleItem(item)}
        disabled={isAdding}
        opacity={isAdding ? 0.5 : 1}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAdded }}
        accessibilityLabel={item.arabicText.substring(0, 60)}>
        <HStack
          padding="$3"
          borderRadius="$4"
          backgroundColor={isAdded ? "$backgroundSuccess" : "$backgroundSecondary"}
          borderWidth={isAdded ? 1 : 0}
          borderColor={isAdded ? "$success" : "transparent"}
          alignItems="flex-start"
          gap="$3"
          marginBottom="$2">
          {/* Checkbox */}
          <Box paddingTop="$1">
            <Icon
              as={isAdded ? CheckSquare : Square}
              size="md"
              color={isAdded ? "$success" : "$typographySecondary"}
            />
          </Box>

          {/* Content */}
          <VStack flex={1} gap="$1">
            <Text
              size="md"
              style={{ writingDirection: "rtl" }}
              textAlign="right"
              color="$typography"
              numberOfLines={3}>
              {item.arabicText}
            </Text>
            {item.translation !== "" && (
              <Text size="xs" color="$typographySecondary" numberOfLines={2}>
                {item.translation}
              </Text>
            )}
            <Text size="xs" color="$typographySecondary">
              {t("athkar.myAthkar.repeatCount")}: {item.repeatCount}
            </Text>
          </VStack>
        </HStack>
      </Pressable>
    );
  };

  const renderSearchResultItem = (item: HisnSearchResult) => {
    const categoryTitle = isArabic ? item.categoryTitleAr : item.categoryTitleEn;
    const isAdded = isSourceAdded(item.id);
    const isAdding = addingIds.has(item.id);

    return (
      <Pressable
        key={item.id}
        onPress={() => handleToggleItem(item)}
        disabled={isAdding}
        opacity={isAdding ? 0.5 : 1}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAdded }}>
        <HStack
          padding="$3"
          borderRadius="$4"
          backgroundColor={isAdded ? "$backgroundSuccess" : "$backgroundSecondary"}
          borderWidth={isAdded ? 1 : 0}
          borderColor={isAdded ? "$success" : "transparent"}
          alignItems="flex-start"
          gap="$3"
          marginBottom="$2">
          <Box paddingTop="$1">
            <Icon
              as={isAdded ? CheckSquare : Square}
              size="md"
              color={isAdded ? "$success" : "$typographySecondary"}
            />
          </Box>
          <VStack flex={1} gap="$1">
            <Text size="xs" color="$typographySecondary" numberOfLines={1}>
              {categoryTitle}
            </Text>
            <Text
              size="md"
              style={{ writingDirection: "rtl" }}
              textAlign="right"
              color="$typography"
              numberOfLines={3}>
              {item.arabicText}
            </Text>
            {item.translation !== "" && (
              <Text size="xs" color="$typographySecondary" numberOfLines={2}>
                {item.translation}
              </Text>
            )}
          </VStack>
        </HStack>
      </Pressable>
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
              <HStack gap="$1" alignItems="center">
                <Icon as={BackIcon} size="sm" color="$primary" />
                <Text size="sm" color="$primary" fontWeight="600">
                  {t("athkar.myAthkar.categories")}
                </Text>
              </HStack>
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
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="space-between"
                    alignItems="center"
                    marginBottom="$2">
                    <Text size="md" fontWeight="500" color="$typography" flex={1} numberOfLines={2}>
                      {isArabic ? cat.titleAr : cat.titleEn}
                    </Text>
                    <Icon
                      as={isRTL ? ChevronLeft : ChevronRight}
                      size="sm"
                      color="$typographySecondary"
                    />
                  </HStack>
                </Pressable>
              ))}

            {/* Search Results */}
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
                {searchResults.map((item) => renderSearchResultItem(item))}
              </>
            )}

            {/* Category Detail — individual athkar with checkboxes */}
            {viewMode === "category-detail" && selectedCategory && (
              <>
                <Text size="lg" fontWeight="600" color="$typography" marginBottom="$2">
                  {isArabic ? selectedCategory.titleAr : selectedCategory.titleEn}
                </Text>
                {categoryAthkar.map((item) => renderAthkarCheckItem(item))}
              </>
            )}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AthkarSearchSheet;
