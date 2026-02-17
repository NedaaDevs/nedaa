// Plugins
import { useTranslation } from "react-i18next";

// Components
import { ActionsheetFlatList } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { Check } from "lucide-react-native";

// Enums
import { AppMode } from "@/enums/app";

// Stores
import { useAppStore } from "@/stores/app";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

type ItemType = {
  id: AppMode;
  title: string;
  description: string;
};

const ThemeList = () => {
  const { mode, setMode } = useAppStore();
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const modeData: ItemType[] = Object.values(AppMode).map((modeCode) => {
    return {
      id: modeCode as AppMode,
      title: t(`settings.themes.${modeCode}.title`),
      description: t(`settings.themes.${modeCode}.description`),
    };
  });

  const handleSelectTheme = (item: ItemType) => {
    hapticSelection();
    setMode(item.id);
  };

  return (
    <Box backgroundColor="$backgroundSecondary" marginTop="$2" borderRadius="$4">
      <ActionsheetFlatList
        data={modeData}
        renderItem={({ item, index }: any) => (
          <Pressable
            onPress={() => handleSelectTheme(item)}
            paddingVertical="$5"
            paddingHorizontal="$5"
            flexDirection="row"
            alignItems="center"
            borderBottomWidth={index < modeData.length - 1 ? 1 : 0}
            borderColor={index < modeData.length - 1 ? "$outline" : undefined}>
            <HStack justifyContent="space-between" alignItems="center" width="100%">
              <Box>
                <Text size="xl" fontWeight="600" color="$typography">
                  {item.title}
                </Text>
                <Text size="lg" color="$typographySecondary" marginTop="$1">
                  {item.description}
                </Text>
              </Box>
              {mode === item.id && <Icon as={Check} color="$accentPrimary" size="lg" />}
            </HStack>
          </Pressable>
        )}
        keyExtractor={(item: any) => item.id}
      />
    </Box>
  );
};

export default ThemeList;
