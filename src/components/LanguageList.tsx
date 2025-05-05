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

type ItemType = {
  id: AppLocale;
  title: string;
  nativeTitle: string;
};

const LanguageList = () => {
  const { locale, setLocale } = useAppStore();
  const { updateAddressTranslation } = useLocationStore();
  const { t } = useTranslation();

  const localeData: ItemType[] = Object.values(AppLocale).map((localeCode) => {
    return {
      id: localeCode as AppLocale,
      title: t(`languages.${localeCode}.title`),
      nativeTitle: t(`languages.${localeCode}.nativeTitle`),
    };
  });

  const handleSelectLanguage = async (item: ItemType) => {
    await setLocale(item.id);

    if (item.id !== locale) {
      await updateAddressTranslation();
    }
  };

  return (
    <Box className="bg-white dark:bg-gray-800 mt-2 rounded-lg">
      <ActionsheetFlatList
        data={localeData}
        renderItem={({ item, index }: any) => (
          <Pressable
            onPress={async () => await handleSelectLanguage(item)}
            className={`py-4 px-4 flex-row justify-between items-center ${
              index < localeData.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""
            }`}>
            <Box>
              <Text className="text-lg font-semibold text-typography dark:text-tertiary">
                {item.title}
              </Text>
              <Text className="text-base text-gray-500 dark:text-gray-400">{item.nativeTitle}</Text>
            </Box>
            {locale === item.id && (
              <Icon as={Check} className="color-primary dark:color-secondary" size="md" />
            )}
          </Pressable>
        )}
        keyExtractor={(item: any) => item.id}
      />
    </Box>
  );
};

export default LanguageList;
