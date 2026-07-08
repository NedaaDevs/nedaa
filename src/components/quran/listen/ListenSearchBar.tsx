import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
};

// Rounded search field with a leading magnifier and a clear button when filled.
export const ListenSearchBar = ({ value, onChangeText, placeholder }: Props) => {
  const { t } = useTranslation();
  return (
    <HStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      borderRadius="$6"
      backgroundColor="$backgroundSecondary"
      borderWidth={1}
      borderColor="$backgroundInteractive">
      <Icon as={Search} size="sm" color="$typographySecondary" />
      <Input
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        backgroundColor="transparent"
        borderWidth={0}
        paddingHorizontal={0}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.listen.clearSearch")}>
          <Icon as={X} size="sm" color="$typographySecondary" />
        </Pressable>
      ) : null}
    </HStack>
  );
};
