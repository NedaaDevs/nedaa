import { useTranslation } from "react-i18next";
import { useBottomSheetInternal } from "@gorhom/bottom-sheet";
import { Search, X } from "lucide-react-native";
import { getFontSize, getTokenValue } from "tamagui";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { SheetInput } from "@/components/ui/sheet-input";
import { VStack } from "@/components/ui/vstack";

const CHIP = "$6";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

/** A search pill: magnifier, field, and a clear chip once there is text. */
export const SearchField = ({ value, onChangeText, placeholder }: Props) => {
  const { t } = useTranslation();
  // Inside a sheet only gorhom's input joins the sheet's keyboard handling.
  const inSheet = useBottomSheetInternal(true) !== null;
  // Read at render: the Tamagui config does not exist when this module loads.
  const fontSize = getFontSize("$4");
  // The chip plus this slop on each side reaches the 44 pt target.
  const chipSlop = (getTokenValue("$target", "size") - getTokenValue(CHIP, "size")) / 2;

  return (
    <HStack
      alignItems="center"
      gap="$2.5"
      height="$target"
      paddingHorizontal="$3.5"
      borderRadius="$pill"
      backgroundColor="$backgroundInteractive">
      <Icon as={Search} size="sm" color="$typographySecondary" />
      {inSheet ? (
        <SheetInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ fontSize }}
        />
      ) : (
        <Input
          flex={1}
          height="100%"
          fontSize={fontSize}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          backgroundColor="transparent"
          borderWidth={0}
          paddingHorizontal={0}
          paddingVertical={0}
          accessibilityLabel={placeholder}
          autoCorrect={false}
          autoCapitalize="none"
        />
      )}
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={chipSlop}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.common.clearSearch")}>
          <VStack
            width={CHIP}
            height={CHIP}
            borderRadius="$pill"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$backgroundSecondary">
            <Icon as={X} size="xs" color="$typographySecondary" />
          </VStack>
        </Pressable>
      ) : null}
    </HStack>
  );
};
