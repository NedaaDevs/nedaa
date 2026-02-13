// Plugins
import { useTranslation } from "react-i18next";

// Components
import { ActionsheetFlatList } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { Check } from "lucide-react-native";

// Enums
import { AppLocale } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

type ItemType = {
  id: AppLocale;
  title: string;
  nativeTitle: string;
};

const LanguageList = () => {
  const { locale, setLocale } = useAppStore();
  const { updateAddressTranslation } = useLocationStore();
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const localeData: ItemType[] = Object.values(AppLocale).map((localeCode) => {
    return {
      id: localeCode as AppLocale,
      title: t(`settings.languages.${localeCode}.title`),
      nativeTitle: t(`settings.languages.${localeCode}.nativeTitle`),
    };
  });

  const handleSelectLanguage = async (item: ItemType) => {
    hapticSelection();

    if (item.id !== locale) {
      await setLocale(item.id);
      await updateAddressTranslation();
    }
  };

  return (
    <Box backgroundColor="$backgroundSecondary" marginTop="$2" borderRadius="$4">
      <ActionsheetFlatList
        data={localeData}
        renderItem={({ item, index }: any) => (
          <Pressable
            onPress={async () => await handleSelectLanguage(item)}
            paddingVertical="$5"
            paddingHorizontal="$5"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            borderBottomWidth={index < localeData.length - 1 ? 1 : 0}
            borderColor={index < localeData.length - 1 ? "$outline" : undefined}>
            <Box>
              <Text size="xl" fontWeight="600" color="$typography">
                {item.title}
              </Text>
              <Text size="lg" color="$typographySecondary" marginTop="$1">
                {item.nativeTitle}
              </Text>
            </Box>
            {locale === item.id && <Icon as={Check} color="$accentPrimary" size="lg" />}
          </Pressable>
        )}
        keyExtractor={(item: any) => item.id}
      />
    </Box>
  );
};

export default LanguageList;
