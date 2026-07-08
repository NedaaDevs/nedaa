import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
};

// A rounded search pill: leading magnifier, centered field, and a clear chip
// that appears once there's text.
export const ListenSearchBar = ({ value, onChangeText, placeholder }: Props) => {
  const { t } = useTranslation();
  return (
    <HStack
      alignItems="center"
      gap="$2.5"
      height={46}
      paddingHorizontal="$3.5"
      borderRadius={23}
      backgroundColor="$backgroundInteractive">
      <Icon as={Search} size="sm" color="$typographySecondary" />
      <Input
        flex={1}
        height="100%"
        fontSize={15}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        backgroundColor="transparent"
        borderWidth={0}
        paddingHorizontal={0}
        paddingVertical={0}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.listen.clearSearch")}>
          <VStack
            width={22}
            height={22}
            borderRadius={11}
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
