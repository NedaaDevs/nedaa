import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Card } from "@/components/ui/card";
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
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";

// Constants
import { PRAYER_ID } from "@/constants/Prayer";

const PRAYERS = [
  { id: PRAYER_ID.FAJR, name: "prayerTimes.fajr" },
  { id: PRAYER_ID.DHUHR, name: "prayerTimes.dhuhr" },
  { id: PRAYER_ID.ASR, name: "prayerTimes.asr" },
  { id: PRAYER_ID.MAGHRIB, name: "prayerTimes.maghrib" },
  { id: PRAYER_ID.ISHA, name: "prayerTimes.isha" },
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
  const timingText = hasTiming
    ? t("common.minute", { count: (defaults as NotificationWithTiming).timing })
    : null;

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

  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const hapticMedium = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const hapticLight = useHaptic(HAPTIC_FEEDBACK.LIGHT);

  const handleToggle = () => {
    hapticSelection();
    setIsExpanded(!isExpanded);
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
      <Card variant="grouped" marginHorizontal="$4">
        {/* Header */}
        <HStack alignItems="center" paddingEnd="$4" backgroundColor="$backgroundMuted">
          {/* The switch sits beside the button: inside it, a reader could not reach it. */}
          <Pressable
            flex={1}
            onPress={handleToggle}
            disabled={!defaults.enabled}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded && defaults.enabled }}
            accessibilityLabel={title}
            accessibilityHint={t("a11y.notification.expandHint")}
            accessibilityValue={timingText ? { text: timingText } : undefined}>
            <HStack padding="$4" gap="$2" alignItems="center">
              <Icon color="$typography" size="xl" as={IconComponent} />
              <HStack gap="$2" alignItems="center" flex={1}>
                <Text size="lg" fontWeight="600" color="$typography">
                  {title}
                </Text>
                {timingText && (
                  <Badge size="sm">
                    <Badge.Text>{timingText}</Badge.Text>
                  </Badge>
                )}
              </HStack>
              {defaults.enabled && (
                <Icon
                  color="$typographySecondary"
                  size="lg"
                  as={isExpanded ? ChevronUp : ChevronDown}
                />
              )}
            </HStack>
          </Pressable>
          <Switch
            value={defaults.enabled}
            onValueChange={handleMainToggle}
            size="md"
            accessibilityLabel={title}
          />
        </HStack>

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
                        accessibilityRole="button"
                        padding="$2"
                        accessibilityLabel={t("a11y.notification.customize", {
                          name: t(prayer.name),
                        })}
                        accessibilityHint={t("a11y.notification.customizeHint")}>
                        <Icon color="$typographySecondary" size="md" as={Settings} />
                      </Pressable>
                    </HStack>
                  );
                })}
              </VStack>
            }
          </VStack>
        )}
      </Card>

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
