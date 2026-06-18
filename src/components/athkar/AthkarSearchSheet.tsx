import { FC, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { TextInput } from "react-native";
import { useTheme } from "tamagui";
import { useTranslation } from "react-i18next";

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
import { Search, ChevronRight, ChevronLeft, Square, SquareCheck, Plus } from "lucide-react-native";

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
  const theme = useTheme();
  const { batchAddItems, removeItem, isSourceAdded, getItemBySourceId } = useMyAthkarStore();
  const hapticSuccess = useHaptic("success");
  const hapticSelection = useHaptic("selection");

  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HisnSearchResult[]>([]);
  const [categories, setCategories] = useState<HisnCategory[]>([]);
  const [categoryAthkar, setCategoryAthkar] = useState<HisnAthkar[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HisnCategory | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<number, HisnAthkar | HisnSearchResult>>(
    new Map()
  );
  const [isAdding, setIsAdding] = useState(false);
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
      setSelectedItems(new Map());
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

  const handleToggleSelect = useCallback(
    (item: HisnAthkar | HisnSearchResult) => {
      if (isSourceAdded(item.id)) {
        // Already added — toggle remove immediately
        hapticSelection();
        const existing = getItemBySourceId(item.id);
        if (existing) {
          removeItem(existing.id);
        }
        return;
      }

      hapticSelection();
      setSelectedItems((prev) => {
        const next = new Map(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.set(item.id, item);
        }
        return next;
      });
    },
    [isSourceAdded, getItemBySourceId, removeItem, hapticSelection]
  );

  const handleBatchAdd = useCallback(async () => {
    if (selectedItems.size === 0) return;
    setIsAdding(true);

    const items = Array.from(selectedItems.values()).map((item) => ({
      sourceAthkarId: item.id,
      sourceCategoryId: item.categoryId,
      repeatCount: item.repeatCount,
    }));

    const success = await batchAddItems(items);
    if (success) {
      hapticSuccess();
      setSelectedItems(new Map());
    }

    setIsAdding(false);
  }, [selectedItems, batchAddItems, hapticSuccess]);

  // Group search results by category
  const groupedSearchResults = useMemo(() => {
    const groups = new Map<
      number,
      { titleAr: string; titleEn: string; items: HisnSearchResult[] }
    >();

    for (const item of searchResults) {
      let group = groups.get(item.categoryId);
      if (!group) {
        group = {
          titleAr: item.categoryTitleAr,
          titleEn: item.categoryTitleEn,
          items: [],
        };
        groups.set(item.categoryId, group);
      }
      group.items.push(item);
    }

    return Array.from(groups.values());
  }, [searchResults]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const renderAthkarCheckItem = (item: HisnAthkar | HisnSearchResult) => {
    const isAdded = isSourceAdded(item.id);
    const isSelected = selectedItems.has(item.id);
    const checked = isAdded || isSelected;

    return (
      <Pressable
        key={item.id}
        onPress={() => handleToggleSelect(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={item.arabicText.substring(0, 60)}>
        <HStack
          padding="$3"
          borderRadius="$4"
          backgroundColor={
            isAdded ? "$backgroundSuccess" : isSelected ? "$backgroundInfo" : "$backgroundSecondary"
          }
          borderWidth={checked ? 1 : 0}
          borderColor={isAdded ? "$success" : isSelected ? "$info" : "transparent"}
          alignItems="flex-start"
          gap="$3"
          marginBottom="$2">
          {/* Checkbox */}
          <Box paddingTop="$1">
            <Icon
              as={checked ? SquareCheck : Square}
              size="md"
              color={isAdded ? "$success" : isSelected ? "$info" : "$typographySecondary"}
            />
          </Box>

          {/* Content — language aware */}
          <VStack flex={1} gap="$1">
            {isArabic ? (
              <Text
                size="md"
                style={{ writingDirection: "rtl", lineHeight: 30 }}
                textAlign="left"
                color="$typography">
                {item.arabicText}
              </Text>
            ) : (
              <>
                {item.translation !== "" ? (
                  <Text size="md" color="$typography">
                    {item.translation}
                  </Text>
                ) : (
                  <Text
                    size="md"
                    style={{ writingDirection: "rtl", lineHeight: 30 }}
                    textAlign="left"
                    color="$typography">
                    {item.arabicText}
                  </Text>
                )}
              </>
            )}
            <Text size="xs" color="$typographySecondary">
              {t("athkar.myAthkar.repeatCount")}: {item.repeatCount}
            </Text>
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
            {/* Plain RN TextInput, not the styled Input: the styled wrapper's text
                renders invisibly inside the sheet on Android. */}
            <TextInput
              style={{
                flex: 1,
                padding: 0,
                color: theme.typography?.val,
                textAlign: isRTL ? "right" : "left",
                writingDirection: isRTL ? "rtl" : "ltr",
              }}
              placeholder={t("athkar.myAthkar.search")}
              placeholderTextColor={theme.typographySecondary?.val}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
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
          <VStack
            gap="$2"
            paddingHorizontal="$4"
            paddingBottom={selectedItems.size > 0 ? "$20" : "$6"}>
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
                    <Text
                      size="md"
                      fontWeight="500"
                      color="$typography"
                      flex={1}
                      numberOfLines={2}
                      textAlign="left">
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

            {/* Search Results — grouped by category */}
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
                {groupedSearchResults.map((group) => (
                  <VStack key={group.titleAr} gap="$2" marginBottom="$3">
                    <Text size="sm" fontWeight="600" color="$typographySecondary" textAlign="left">
                      {isArabic ? group.titleAr : group.titleEn}
                    </Text>
                    {group.items.map((item) => renderAthkarCheckItem(item))}
                  </VStack>
                ))}
              </>
            )}

            {/* Category Detail — individual athkar with checkboxes */}
            {viewMode === "category-detail" && selectedCategory && (
              <>
                <Text
                  size="lg"
                  fontWeight="600"
                  color="$typography"
                  marginBottom="$2"
                  textAlign="left">
                  {isArabic ? selectedCategory.titleAr : selectedCategory.titleEn}
                </Text>
                {categoryAthkar.map((item) => renderAthkarCheckItem(item))}
              </>
            )}
          </VStack>
        </ActionsheetScrollView>

        {/* Batch Add Button */}
        {selectedItems.size > 0 && (
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            padding="$4"
            paddingBottom="$6"
            backgroundColor="$backgroundSecondary"
            borderTopWidth={1}
            borderTopColor="$outline">
            <Button
              size="lg"
              onPress={handleBatchAdd}
              disabled={isAdding}
              opacity={isAdding ? 0.6 : 1}
              accessibilityRole="button"
              accessibilityLabel={t("athkar.myAthkar.add")}>
              <Button.Icon as={Plus} />
              <Button.Text>
                {t("athkar.myAthkar.add")} ({selectedItems.size})
              </Button.Text>
            </Button>
          </Box>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AthkarSearchSheet;
