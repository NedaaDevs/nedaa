import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";

// Icons
import { Zap, ChevronDown } from "lucide-react-native";

type Props = {
  currentSound: string;
  vibrationEnabled: boolean;
  onApply: (sound: string, vibration: boolean) => void;
  supportsVibration?: boolean;
};

const NotificationQuickSetup: FC<Props> = ({
  currentSound,
  vibrationEnabled,
  onApply,
  supportsVibration = true,
}) => {
  const { t } = useTranslation();

  // Local state for quick setup
  const [localSound, setLocalSound] = useState(currentSound);
  const [localVibration, setLocalVibration] = useState(vibrationEnabled);

  //   TODO: add sounds
  const soundOptions = [
    { label: "notification.sound.makkahAthan", value: "makkah" },
    { label: "notification.sound.madinahAthan", value: "madinah" },
    { label: "notification.sound.default", value: "default" },
    { label: "notification.sound.silent", value: "silent" },
  ];

  const handleApply = () => {
    onApply(localSound, localVibration);
  };

  return (
    <Box className="bg-blue-50 dark:bg-blue-900/20 mx-4 p-4 rounded-lg">
      <VStack space="md">
        <HStack space="sm" className="items-center">
          <Zap className="text-blue-600 dark:text-blue-400" size={20} />
          <Text className="text-base font-semibold text-blue-800 dark:text-blue-200">
            {t("notification.quickSetup")}
          </Text>
        </HStack>

        <Text className="text-left text-sm text-blue-700 dark:text-blue-300">
          {t("notification.quickSetupDescription")}
        </Text>

        <VStack space="sm">
          <HStack className="justify-between items-center">
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              {t("notification.sound")}
            </Text>
            <Select selectedValue={localSound} onValueChange={setLocalSound}>
              <SelectTrigger variant="outline" size="sm" className="w-40">
                <SelectInput />
                <SelectIcon>
                  <ChevronDown size={16} />
                </SelectIcon>
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                  <SelectScrollView>
                    {soundOptions.map((option) => (
                      <SelectItem key={option.value} label={t(option.label)} value={option.value} />
                    ))}
                  </SelectScrollView>
                </SelectContent>
              </SelectPortal>
            </Select>
          </HStack>

          {supportsVibration && (
            <HStack className="justify-between items-center">
              <Text className="text-sm text-blue-700 dark:text-blue-300">
                {t("notification.vibration")}
              </Text>
              <Switch
                value={localVibration}
                onValueChange={setLocalVibration}
                size="sm"
                className="data-[state=checked]:bg-primary-500"
              />
            </HStack>
          )}
        </VStack>

        <Button onPress={handleApply} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <ButtonText>{t("notification.applyToAll")}</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};

export default NotificationQuickSetup;
