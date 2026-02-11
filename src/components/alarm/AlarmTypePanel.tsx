import { FC, useState } from "react";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Divider } from "@/components/ui/divider";

import { ChevronDown, ChevronUp, Sun, Building2, LucideIcon } from "lucide-react-native";

import SoundPicker from "./SoundPicker";
import VolumeSlider from "./VolumeSlider";
import ChallengePicker from "./ChallengePicker";
import GentleWakeUpSettings from "./GentleWakeUpSettings";
import VibrationSettings from "./VibrationSettings";
import SnoozeSettings from "./SnoozeSettings";

import { AlarmType, AlarmTypeSettings } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  alarmType: AlarmType;
  title: string;
  settings: AlarmTypeSettings;
  onSettingsChange: (settings: Partial<AlarmTypeSettings>) => void;
  defaultExpanded?: boolean;
};

const ALARM_ICONS: Record<AlarmType, LucideIcon> = {
  fajr: Sun,
  friday: Building2,
};

const AlarmTypePanel: FC<Props> = ({
  alarmType,
  title,
  settings,
  onSettingsChange,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");

  const IconComponent = ALARM_ICONS[alarmType];

  const handleToggle = () => {
    hapticSelection();
    if (settings.enabled) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleMainToggle = (enabled: boolean) => {
    hapticMedium();
    onSettingsChange({ enabled });
    if (enabled && !isExpanded) {
      setIsExpanded(true);
    }
  };

  return (
    <Box className="bg-background-secondary mx-4 rounded-lg overflow-hidden shadow-sm">
      <Pressable onPress={handleToggle} disabled={!settings.enabled}>
        <HStack className="p-4 justify-between items-center bg-background-muted">
          <HStack space="sm" className="items-center flex-1">
            <Icon
              className={alarmType === "fajr" ? "text-warning" : "text-success"}
              size="xl"
              as={IconComponent}
            />
            <Text className="text-lg font-semibold text-typography">{title}</Text>
          </HStack>
          <HStack space="sm" className="items-center">
            <Switch value={settings.enabled} onValueChange={handleMainToggle} size="md" />
            {settings.enabled && (
              <Box className="ms-2">
                {isExpanded ? (
                  <Icon className="text-typography-secondary" size="lg" as={ChevronUp} />
                ) : (
                  <Icon className="text-typography-secondary" size="lg" as={ChevronDown} />
                )}
              </Box>
            )}
          </HStack>
        </HStack>
      </Pressable>

      {isExpanded && settings.enabled && (
        <VStack className="p-4" space="lg">
          <SoundPicker value={settings.sound} onChange={(sound) => onSettingsChange({ sound })} />

          <VolumeSlider
            value={settings.volume}
            onChange={(volume) => onSettingsChange({ volume })}
          />

          <Divider className="my-1" />

          <ChallengePicker
            value={settings.challenge}
            onChange={(challenge) => onSettingsChange({ challenge })}
          />

          <Divider className="my-1" />

          <GentleWakeUpSettings
            value={settings.gentleWakeUp}
            onChange={(gentleWakeUp) => onSettingsChange({ gentleWakeUp })}
          />

          <VibrationSettings
            value={settings.vibration}
            onChange={(vibration) => onSettingsChange({ vibration })}
          />

          <SnoozeSettings
            value={settings.snooze}
            onChange={(snooze) => onSettingsChange({ snooze })}
          />
        </VStack>
      )}
    </Box>
  );
};

export default AlarmTypePanel;
