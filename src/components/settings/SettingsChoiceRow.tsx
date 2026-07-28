import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";

type Option<T extends string> = {
  value: T;
  labelKey: string;
};

type Props<T extends string> = {
  titleKey: string;
  descriptionKey?: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
};

/**
 * A settings card offering one choice from a short list, laid out as a wrapping
 * row of pills. Suits 2–4 options; anything longer wants a sheet instead.
 */
const SettingsChoiceRow = <T extends string>({
  titleKey,
  descriptionKey,
  value,
  onChange,
  options,
}: Props<T>) => {
  const { t } = useTranslation();

  return (
    <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
      <VStack gap="$3">
        <VStack>
          <Text fontWeight="500" color="$typography">
            {t(titleKey)}
          </Text>
          {descriptionKey && (
            <Text size="sm" color="$typographySecondary" marginTop="$1">
              {t(descriptionKey)}
            </Text>
          )}
        </VStack>

        <HStack gap="$2" flexWrap="wrap">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderRadius="$10"
                minHeight={44}
                alignItems="center"
                justifyContent="center"
                backgroundColor={isSelected ? "$primary" : "$backgroundInteractive"}
                borderWidth={1}
                borderColor={isSelected ? "$primary" : "$outline"}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t(option.labelKey)}>
                <Text
                  size="sm"
                  fontWeight={isSelected ? "600" : "400"}
                  color={isSelected ? "$typographyContrast" : "$typography"}>
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </VStack>
    </Box>
  );
};

export default SettingsChoiceRow;
