import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react-native";

// Components
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

// Utils
import { formatCityLabel } from "@/utils/cities";

// Types
import type { CitySearchResult } from "@/types/cities";

type CityResultRowProps = {
  city: CitySearchResult;
  onSelect: (city: CitySearchResult) => void;
  disabled?: boolean;
};

const CityResultRow = ({ city, onSelect, disabled = false }: CityResultRowProps) => {
  const { t, i18n } = useTranslation();
  const label = formatCityLabel(city, i18n.language);

  return (
    <Pressable
      onPress={() => onSelect(city)}
      disabled={disabled}
      minHeight={44}
      paddingVertical="$3"
      paddingHorizontal="$5"
      accessibilityRole="button"
      accessibilityLabel={t("a11y.location.picker.selectCity", {
        city: label.city,
        secondary: label.secondary,
      })}
      accessibilityHint={t("a11y.location.picker.selectCityHint")}
      accessibilityState={{ disabled }}>
      <HStack alignItems="center" gap="$3">
        <Icon as={MapPin} color="$accentPrimary" size="sm" />
        <VStack flex={1}>
          <Text size="md" color="$typography">
            {label.city}
          </Text>
          <Text size="sm" color="$typographySecondary">
            {label.secondary}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};

export default CityResultRow;
