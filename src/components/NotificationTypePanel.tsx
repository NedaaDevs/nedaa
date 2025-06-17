import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

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
import { useHaptic } from "@/hooks/useHaptic";

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

    const customTiming = hasTiming && hasOverride.timing !== undefined;

    let label = t("notification.customized");
    if (customTiming) {
      label = `${t("notification.custom")}:  ${t("common.minute", { count: hasOverride.timing })}`;
    }

    return { isCustom: true, label };
  };

  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");
  const hapticLight = useHaptic("light");

  const handleToggle = () => {
    hapticSelection();
    if (defaults.enabled) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleMainToggle = (value: boolean) => {
    hapticMedium();
    onDefaultUpdate("enabled", value);
    if (value && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const openCustomization = (prayerId: string) => {
    hapticLight();
    setModalPrayer(prayerId);
  };

  return (
    <>
      <Box className="bg-background-secondary mx-4 rounded-lg overflow-hidden shadow-sm">
        {/* Header */}
        <Pressable onPress={handleToggle} disabled={!defaults.enabled}>
          <HStack className="p-4 justify-between items-center bg-background-muted">
            <HStack space="sm" className="items-center flex-1">
              <Icon className="text-typography" size="xl" as={IconComponent} />
              <VStack className="flex-1">
                <HStack space="sm" className="items-center">
                  <Text className="text-lg font-semibold text-typography">{title}</Text>
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
              <Switch value={defaults.enabled} onValueChange={handleMainToggle} size="md" />
              {defaults.enabled && (
                <Box className="ml-2">
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

        {/* Expanded Content */}
        {isExpanded && defaults.enabled && (
          <VStack className="p-4" space="md">
            {
              <VStack space="xs">
                {PRAYERS.map((prayer) => {
                  const status = getPrayerStatus(prayer.id);
                  return (
                    <HStack key={prayer.id} className="justify-between items-center py-3 px-2">
                      <HStack space="sm" className="items-center flex-1">
                        <Text className="text-base text-typography">{t(prayer.name)}</Text>
                        <Badge size="sm">
                          <BadgeText>{status.label}</BadgeText>
                        </Badge>
                      </HStack>
                      <Pressable onPress={() => openCustomization(prayer.id)} className="p-2">
                        <Icon className="text-typography-secondary" size="md" as={Settings} />
                      </Pressable>
                    </HStack>
                  );
                })}
              </VStack>
            }
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
