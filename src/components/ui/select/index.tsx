import React from "react";
import { Select as TamaguiSelect, Adapt, Sheet } from "tamagui";

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

const Select: React.FC<SelectProps> = ({
  selectedValue,
  placeholder,
  onValueChange,
  items,
  groups,
  disabled,
  size,
}) => {
  const allItems = items ?? groups?.flatMap((g) => g.items) ?? [];

  return (
    <TamaguiSelect
      value={selectedValue}
      onValueChange={onValueChange}
      disablePreventBodyScroll
      size={size}>
      <TamaguiSelect.Trigger
        disabled={disabled}
        borderColor="$outline"
        borderWidth={1}
        borderRadius="$4"
        backgroundColor="$backgroundSecondary"
        minHeight={44}
        flexShrink={1}>
        <TamaguiSelect.Value placeholder={placeholder} />
      </TamaguiSelect.Trigger>

      <Adapt platform="touch">
        <Sheet modal snapPoints={[50]} dismissOnOverlayPress disableDrag>
          <Sheet.Frame>
            <Sheet.ScrollView
              bounces={false}
              nestedScrollEnabled
              overScrollMode="never"
              showsVerticalScrollIndicator>
              <Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>
          <Sheet.Overlay backgroundColor="rgba(0,0,0,0.5)" />
        </Sheet>
      </Adapt>

      <TamaguiSelect.Content>
        <TamaguiSelect.Viewport>
          {groups ? (
            groups.map((group, gi) => {
              const baseIndex = groups.slice(0, gi).reduce((sum, g) => sum + g.items.length, 0);
              return (
                <TamaguiSelect.Group key={gi}>
                  {group.label && <TamaguiSelect.Label>{group.label}</TamaguiSelect.Label>}
                  {group.items.map((item, itemIdx) => (
                    <TamaguiSelect.Item
                      key={item.value}
                      index={baseIndex + itemIdx}
                      value={item.value}>
                      <TamaguiSelect.ItemText>{item.label}</TamaguiSelect.ItemText>
                    </TamaguiSelect.Item>
                  ))}
                </TamaguiSelect.Group>
              );
            })
          ) : (
            <TamaguiSelect.Group>
              {allItems.map((item, idx) => (
                <TamaguiSelect.Item key={item.value} index={idx} value={item.value}>
                  <TamaguiSelect.ItemText>{item.label}</TamaguiSelect.ItemText>
                </TamaguiSelect.Item>
              ))}
            </TamaguiSelect.Group>
          )}
        </TamaguiSelect.Viewport>
      </TamaguiSelect.Content>
    </TamaguiSelect>
  );
};
Select.displayName = "Select";

export { Select };
export type { SelectProps, SelectItem, SelectGroup };
