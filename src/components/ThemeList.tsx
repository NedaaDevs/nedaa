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
import { AppMode } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";

type ItemType = {
  id: AppMode;
  title: string;
  description: string;
};

const ThemeList = () => {
  const { mode, setMode } = useAppStore();
  const { t } = useTranslation();

  const modeData: ItemType[] = Object.values(AppMode).map((modeCode) => {
    return {
      id: modeCode as AppMode,
      title: t(`settings.themes.${modeCode}.title`),
      description: t(`settings.themes.${modeCode}.description`),
    };
  });

  const handleSelectTheme = (item: ItemType) => {
    setMode(item.id);
  };

  return (
    <Box className="bg-background-secondary mt-2 rounded-lg">
      <ActionsheetFlatList
        data={modeData}
        renderItem={({ item, index }: any) => (
          <Pressable
            onPress={() => handleSelectTheme(item)}
            className={`py-5 px-5 flex-row justify-between items-center ${
              index < modeData.length - 1 ? "border-b border-outline" : ""
            }`}>
            <Box>
              <Text className="text-xl font-semibold text-typography">{item.title}</Text>
              <Text className="text-lg text-typography-secondary mt-1">{item.description}</Text>
            </Box>
            {mode === item.id && <Icon as={Check} className="text-accent-primary" size="lg" />}
          </Pressable>
        )}
        keyExtractor={(item: any) => item.id}
      />
    </Box>
  );
};

export default ThemeList;
