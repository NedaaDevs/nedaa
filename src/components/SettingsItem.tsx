// Plugins
import { Link } from "expo-router";
import { I18nManager } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { ChevronRight, ChevronLeft } from "lucide-react-native";

// Types
import type { Href } from "expo-router";

type Props = {
  name: string;
  path: Href;
  icon?: any;
  rtl?: boolean;
  currentValue?: string;
};

const SettingsItem = ({ name, path, icon, currentValue, rtl = I18nManager.isRTL }: Props) => {
  const { t } = useTranslation();
  const ChevronIcon = rtl ? ChevronLeft : ChevronRight;

  const accessibilityLabel = currentValue
    ? t("accessibility.settingsItemWithValue", { itemName: name, currentValue })
    : t("accessibility.settingsItem", { itemName: name });

  const accessibilityHint = t("accessibility.navigateToSettings", { settingName: name });

  return (
    <Box
      className="relative inset-0 m-2 p-5 rounded-lg overflow-hidden bg-background-secondary"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}>
      <Link href={path} asChild>
        <Pressable
          className="flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}>
          <HStack className="justify-between items-center relative z-10 w-full">
            <HStack className="items-center">
              {icon && (
                <Box className="mr-6">
                  <Icon className="font-bold text-typography" size="lg" as={icon} />
                </Box>
              )}
              <Text className="text-xl font-medium text-typography">{name}</Text>
            </HStack>

            <HStack className="items-center">
              {currentValue && (
                <Text className="text-lg text-typography-secondary mr-2">{currentValue}</Text>
              )}
              <Icon size="xl" className="text-typography-secondary" as={ChevronIcon} />
            </HStack>
          </HStack>
        </Pressable>
      </Link>
    </Box>
  );
};

export default SettingsItem;
