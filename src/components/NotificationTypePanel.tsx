import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";

// Icons
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Bell,
  Clock,
  BellRing,
  LucideIcon,
} from "lucide-react-native";

// Components
import PrayerCustomizationModal from "@/components/PrayerCustomizationModal";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";

const PRAYERS = [
  { id: "fajr", name: "prayerTimes.fajr" },
  { id: "dhuhr", name: "prayerTimes.dhuhr" },
  { id: "asr", name: "prayerTimes.asr" },
  { id: "maghrib", name: "prayerTimes.maghrib" },
  { id: "isha", name: "prayerTimes.isha" },
];

type Props = {
  type: NotificationType;
  title: string;
  icon: "Bell" | "Clock" | "BellRing";
  iconColor: string;
  defaults: NotificationConfig | NotificationWithTiming;
  overrides: Record<string, any>;
  onDefaultUpdate: (field: keyof NotificationConfig, value: any) => void;
  onOverrideUpdate: (prayerId: string, config: any) => void;
  onResetOverride: (prayerId: string) => void;
  defaultExpanded?: boolean;
  hasTiming?: boolean;
  timingLabel?: string;
  supportsVibration?: boolean;
};

const NotificationTypePanel: FC<Props> = ({
  type,
  title,
  icon,
  iconColor,
  defaults,
  overrides,
  onDefaultUpdate,
  onOverrideUpdate,
  onResetOverride,
  defaultExpanded = false,
  hasTiming = false,
  timingLabel,
  supportsVibration = true,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showIndividualPrayers, setShowIndividualPrayers] = useState(false);
  const [modalPrayer, setModalPrayer] = useState<string | null>(null);

  const iconMap: Record<string, LucideIcon> = {
    Bell,
    Clock,
    BellRing,
  };

  const IconComponent = iconMap[icon];

  const getPrayerStatus = (prayerId: string) => {
    const hasOverride = overrides[prayerId]?.[type];
    if (!hasOverride) return { isCustom: false, label: t("notification.usingDefault") };

    // Check what's customized
    const customTiming = hasTiming && hasOverride.timing !== undefined;
    // const customSound = hasOverride.sound !== undefined;
    // const customVibration = hasOverride.vibration !== undefined;

    let label = t("notification.customized");
    if (customTiming && hasOverride.timing) {
      label = `${t("notification.custom")}:  ${t("common.minute", { count: hasOverride.timing })}`;
    }

    return { isCustom: true, label };
  };

  const handleToggle = () => {
    if (defaults.enabled) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleMainToggle = (value: boolean) => {
    onDefaultUpdate("enabled", value);
    if (value && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const openCustomization = (prayerId: string) => {
    setModalPrayer(prayerId);
  };

  return (
    <>
      <Box className="bg-white dark:bg-slate-800 mx-4 rounded-lg overflow-hidden shadow-sm">
        {/* Header */}
        <Pressable onPress={handleToggle} disabled={!defaults.enabled}>
          <HStack className="p-4 justify-between items-center bg-gray-50 dark:bg-slate-700">
            <HStack space="sm" className="items-center flex-1">
              <IconComponent className={iconColor} size={24} />
              <VStack className="flex-1">
                <HStack space="sm" className="items-center">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </Text>
                  {hasTiming && (
                    <Badge size="sm" variant="outline">
                      <BadgeText>
                        {t("common.minute", {
                          count: (defaults as NotificationWithTiming).timing,
                        })}
                      </BadgeText>
                    </Badge>
                  )}
                </HStack>
              </VStack>
            </HStack>
            <HStack space="sm" className="items-center">
              <Switch
                value={defaults.enabled}
                onValueChange={handleMainToggle}
                size="md"
                className="data-[state=checked]:bg-primary-500"
              />
              {defaults.enabled && (
                <Box className="ml-2">
                  {isExpanded ? (
                    <ChevronUp className="text-gray-500 dark:text-gray-400" size={20} />
                  ) : (
                    <ChevronDown className="text-gray-500 dark:text-gray-400" size={20} />
                  )}
                </Box>
              )}
            </HStack>
          </HStack>
        </Pressable>

        {/* Expanded Content */}
        {isExpanded && defaults.enabled && (
          <VStack className="p-4" space="md">
            {!showIndividualPrayers ? (
              <>
                <Box className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                  <Text className="text-left text-sm text-gray-700 dark:text-gray-300">
                    {t("notification.allPrayersUsingDefault")}
                  </Text>
                </Box>
                <Button variant="outline" size="sm" onPress={() => setShowIndividualPrayers(true)}>
                  <ButtonText>{t("notification.customizeIndividualPrayers")}</ButtonText>
                </Button>
              </>
            ) : (
              <VStack space="xs">
                {PRAYERS.map((prayer) => {
                  const status = getPrayerStatus(prayer.id);
                  return (
                    <HStack key={prayer.id} className="justify-between items-center py-3 px-2">
                      <HStack space="sm" className="items-center flex-1">
                        <Text className="text-base text-gray-900 dark:text-gray-100">
                          {t(prayer.name)}
                        </Text>
                        <Badge size="sm">
                          <BadgeText>{status.label}</BadgeText>
                        </Badge>
                      </HStack>
                      <Pressable onPress={() => openCustomization(prayer.id)} className="p-2">
                        <Settings className="text-gray-500 dark:text-gray-400" size={18} />
                      </Pressable>
                    </HStack>
                  );
                })}
              </VStack>
            )}
          </VStack>
        )}
      </Box>

      {/* Customization Modal */}
      {modalPrayer && (
        <PrayerCustomizationModal
          isOpen={!!modalPrayer}
          onClose={() => setModalPrayer(null)}
          prayerId={modalPrayer}
          prayerName={t(PRAYERS.find((p) => p.id === modalPrayer)?.name || "")}
          type={type}
          defaults={defaults}
          currentOverride={overrides[modalPrayer]?.[type]}
          onSave={(config: any) => onOverrideUpdate(modalPrayer, config)}
          onReset={() => onResetOverride(modalPrayer)}
          hasTiming={hasTiming}
          timingLabel={timingLabel}
          supportsVibration={supportsVibration}
        />
      )}
    </>
  );
};

export default NotificationTypePanel;
