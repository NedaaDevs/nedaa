import React, { useState, useMemo, useRef, useCallback } from "react";
import { Modal, ScrollView, TouchableOpacity, View, StyleSheet } from "react-native";
import { Text, useTheme } from "tamagui";
import { Pressable } from "@/components/ui/pressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectItem = {
  label: string;
  value: string;
};

type SelectGroup = {
  label?: string;
  items: SelectItem[];
};

type SelectProps = {
  selectedValue?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  items?: SelectItem[];
  groups?: SelectGroup[];
  disabled?: boolean;
  size?: "$2" | "$3" | "$4" | "$5";
};

const ITEM_HEIGHT = 44;

const Select: React.FC<SelectProps> = ({
  selectedValue,
  placeholder,
  onValueChange,
  items,
  groups,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const allItems = useMemo(() => items ?? groups?.flatMap((g) => g.items) ?? [], [items, groups]);

  const selectedLabel = useMemo(
    () => allItems.find((item) => item.value === selectedValue)?.label,
    [allItems, selectedValue]
  );

  const selectedIndex = useMemo(
    () => allItems.findIndex((item) => item.value === selectedValue),
    [allItems, selectedValue]
  );

  const scrollToSelected = useCallback(() => {
    if (selectedIndex > 0) {
      const offset = Math.max(0, selectedIndex * ITEM_HEIGHT - ITEM_HEIGHT * 2);
      scrollRef.current?.scrollTo({ y: offset, animated: false });
    }
  }, [selectedIndex]);

  const handleOpen = () => setOpen(true);

  const handleSelect = (value: string) => {
    onValueChange?.(value);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={handleOpen}
        borderColor="$outline"
        borderWidth={1}
        borderRadius="$4"
        backgroundColor="$backgroundSecondary"
        minHeight={44}
        paddingHorizontal="$3"
        justifyContent="center"
        opacity={disabled ? 0.5 : 1}>
        <Text color={selectedLabel ? "$typography" : "$typographySecondary"}>
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.background.val,
                paddingBottom: insets.bottom || 16,
              },
            ]}>
            <View style={[styles.handle, { backgroundColor: theme.borderColor.val }]} />
            <ScrollView
              ref={scrollRef}
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              onLayout={scrollToSelected}
              style={styles.scrollView}>
              {groups
                ? groups.map((group, gi) => (
                    <View key={gi}>
                      {group.label && (
                        <Text
                          color="$typographySecondary"
                          fontSize="$2"
                          fontWeight="600"
                          paddingHorizontal="$4"
                          paddingVertical="$2">
                          {group.label}
                        </Text>
                      )}
                      {group.items.map((item) => (
                        <SelectOption
                          key={item.value}
                          item={item}
                          isSelected={item.value === selectedValue}
                          onSelect={handleSelect}
                        />
                      ))}
                    </View>
                  ))
                : allItems.map((item) => (
                    <SelectOption
                      key={item.value}
                      item={item}
                      isSelected={item.value === selectedValue}
                      onSelect={handleSelect}
                    />
                  ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};
Select.displayName = "Select";

const SelectOption: React.FC<{
  item: SelectItem;
  isSelected: boolean;
  onSelect: (value: string) => void;
}> = ({ item, isSelected, onSelect }) => (
  <Pressable
    onPress={() => onSelect(item.value)}
    paddingHorizontal="$4"
    paddingVertical="$3"
    backgroundColor={isSelected ? "$backgroundMuted" : "transparent"}
    minHeight={44}>
    <Text color="$typography" fontWeight={isSelected ? "600" : "400"}>
      {item.label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    maxHeight: "80%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  scrollView: {
    flexGrow: 0,
  },
});

export { Select };
export type { SelectProps, SelectItem, SelectGroup };
