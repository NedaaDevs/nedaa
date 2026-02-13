import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
      <Box backgroundColor="$backgroundSecondary" marginHorizontal="$4" borderRadius="$4">
        {/* Header */}
        <Pressable onPress={handleToggle} disabled={!defaults.enabled}>
          <HStack
            padding="$4"
            justifyContent="space-between"
            alignItems="center"
            backgroundColor="$backgroundMuted">
            <HStack gap="$2" alignItems="center" flex={1}>
              <Icon color="$typography" size="xl" as={IconComponent} />
              <VStack flex={1}>
                <HStack gap="$2" alignItems="center">
                  <Text size="lg" fontWeight="600" color="$typography">
                    {title}
                  </Text>
                  {hasTiming && (
                    <Badge size="sm" variant="outline">
                      <Badge.Text>
                        {t("common.minute", {
                          count: (defaults as NotificationWithTiming).timing,
                        })}
                      </Badge.Text>
                    </Badge>
                  )}
                </HStack>
              </VStack>
            </HStack>
            <HStack gap="$2" alignItems="center">
              <Switch
                value={defaults.enabled}
                onValueChange={handleMainToggle}
                size="md"
                accessibilityLabel={title}
              />
              {defaults.enabled && (
                <Box marginStart="$2">
                  {isExpanded ? (
                    <Icon color="$typographySecondary" size="lg" as={ChevronUp} />
                  ) : (
                    <Icon color="$typographySecondary" size="lg" as={ChevronDown} />
                  )}
                </Box>
              )}
            </HStack>
          </HStack>
        </Pressable>

        {/* Expanded Content */}
        {isExpanded && defaults.enabled && (
          <VStack padding="$4" gap="$3">
            {
              <VStack gap="$1">
                {PRAYERS.map((prayer) => {
                  const status = getPrayerStatus(prayer.id);
                  return (
                    <HStack
                      key={prayer.id}
                      justifyContent="space-between"
                      alignItems="center"
                      paddingVertical="$3"
                      paddingHorizontal="$2">
                      <HStack gap="$2" alignItems="center" flex={1}>
                        <Text color="$typography">{t(prayer.name)}</Text>
                        <Badge size="sm">
                          <Badge.Text>{status.label}</Badge.Text>
                        </Badge>
                      </HStack>
                      <Pressable
                        onPress={() => openCustomization(prayer.id)}
                        padding="$2"
                        accessibilityLabel={t(prayer.name)}>
                        <Icon color="$typographySecondary" size="md" as={Settings} />
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
