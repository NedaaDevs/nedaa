import { FC, useState, useEffect } from "react";
import type { NotificationContent } from "expo-notifications";
import { ScrollView } from "react-native";
import { useTheme } from "tamagui";

// Utils
import { listScheduledNotifications } from "@/utils/notifications";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { Badge } from "@/components/ui/badge";

// Icons
import { XIcon } from "lucide-react-native";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

type NotificationTrigger =
  | {
      repeats: boolean;
      class: string;
      type: "timeInterval";
      seconds: number;
    }
  | {
      channelId: string;
      value: number;
      repeats: boolean;
      type: "date";
    };

type ScheduledNotification = {
  identifier: string;
  content: NotificationContent;
  trigger: NotificationTrigger;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type FilterType = "all" | "prayer" | "iqama" | "preAthan" | "athkar" | "qada";

export const NotificationDebugModal: FC<Props> = ({ isOpen, onClose }) => {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchNotifications = async () => {
    const list = await listScheduledNotifications();
    // Sort notifications by date
    const sortedList = (list as ScheduledNotification[]).sort((a, b) => {
      const getTime = (trigger: NotificationTrigger) => {
        if (trigger.type === "timeInterval") {
          return Date.now() + trigger.seconds * 1000;
        } else {
          return trigger.value;
        }
      };
      return getTime(a.trigger) - getTime(b.trigger);
    });
    setNotifications(sortedList);
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      setFilter("all"); // Reset filter when modal opens
    }
  }, [isOpen]);

  // Filter notifications based on selected type
  const getNotificationType = (notification: ScheduledNotification): string => {
    const data = notification.content.data as { type?: string; categoryId?: string } | undefined;
    const type = data?.type;
    const categoryId = data?.categoryId;

    // Check type first
    if (type === "QADA_REMINDER") return NOTIFICATION_TYPE.QADA;
    if (type === "ATHKAR") return NOTIFICATION_TYPE.ATHKAR;

    // Check categoryId for prayer-related notifications
    if (categoryId?.startsWith("prayer_")) return NOTIFICATION_TYPE.PRAYER;
    if (categoryId?.startsWith("iqama_")) return NOTIFICATION_TYPE.IQAMA;
    if (categoryId?.startsWith("preathan_")) return NOTIFICATION_TYPE.PRE_ATHAN;

    return "unknown";
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "all") return true;
    const notifType = getNotificationType(notification);
    return notifType === filter;
  });

  // Count notifications by type
  const getCounts = () => {
    const counts = {
      all: notifications.length,
      prayer: 0,
      iqama: 0,
      preAthan: 0,
      athkar: 0,
      qada: 0,
    };

    notifications.forEach((notification) => {
      const type = getNotificationType(notification);
      if (type === NOTIFICATION_TYPE.PRAYER) counts.prayer++;
      else if (type === NOTIFICATION_TYPE.IQAMA) counts.iqama++;
      else if (type === NOTIFICATION_TYPE.PRE_ATHAN) counts.preAthan++;
      else if (type === NOTIFICATION_TYPE.ATHKAR) counts.athkar++;
      else if (type === NOTIFICATION_TYPE.QADA) counts.qada++;
    });

    return counts;
  };

  const counts = getCounts();

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "prayer", label: "Prayer", count: counts.prayer },
    { key: "iqama", label: "Iqama", count: counts.iqama },
    { key: "preAthan", label: "Pre-Athan", count: counts.preAthan },
    { key: "athkar", label: "Athkar", count: counts.athkar },
    { key: "qada", label: "Qada", count: counts.qada },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Box
        flex={1}
        backgroundColor="transparent"
        alignItems="center"
        justifyContent="flex-end"
        padding="$4">
        <Box
          backgroundColor="$backgroundSecondary"
          borderTopLeftRadius="$8"
          borderTopRightRadius="$8"
          width="100%"
          maxHeight="85%"
          minHeight="70%">
          {/* Header */}
          <Box padding="$6" borderBottomWidth={1} borderColor="$outline">
            <HStack justifyContent="space-between" alignItems="center" marginBottom="$4">
              <Text size="xl" fontWeight="600" color="$typography">
                Scheduled Notifications
              </Text>
              <Pressable padding="$2" borderRadius="$2" onPress={onClose}>
                <XIcon size={24} color={theme.typographySecondary.val} />
              </Pressable>
            </HStack>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
              <HStack gap="$1" paddingRight="$2">
                {filterButtons.map((btn) => (
                  <Pressable
                    key={btn.key}
                    onPress={() => setFilter(btn.key)}
                    paddingHorizontal="$3"
                    paddingVertical="$1"
                    borderRadius="$4"
                    backgroundColor={filter === btn.key ? "$primary" : "$backgroundMuted"}>
                    <Text
                      size="sm"
                      fontWeight="500"
                      color={filter === btn.key ? "$background" : "$typography"}>
                      {btn.label} ({btn.count})
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </ScrollView>
          </Box>

          {/* Content */}
          <ScrollView style={{ flex: 1, paddingHorizontal: 24 }}>
            <Box paddingVertical="$6">
              {filteredNotifications.length === 0 ? (
                <Text color="$typography" textAlign="center">
                  {notifications.length === 0
                    ? "No scheduled notifications found"
                    : `No ${filter} notifications found`}
                </Text>
              ) : (
                <VStack gap="$4">
                  {filteredNotifications.map((notification, index) => (
                    <Box
                      key={index}
                      backgroundColor="$background"
                      padding="$4"
                      borderRadius="$6"
                      borderWidth={1}
                      borderColor="$outline">
                      <VStack gap="$2">
                        <HStack
                          justifyContent="space-between"
                          alignItems="center"
                          marginBottom="$1">
                          <Text color="$typography" fontWeight="600" size="xs">
                            #{index + 1}
                          </Text>
                          <Badge size="sm" variant="outline">
                            <Badge.Text size="sm">{getNotificationType(notification)}</Badge.Text>
                          </Badge>
                        </HStack>
                        <Text color="$typography" fontWeight="600">
                          {notification.content.title}
                        </Text>
                        <Text color="$typographySecondary" size="sm">
                          {notification.content.body}
                        </Text>
                        <Box
                          marginTop="$2"
                          paddingTop="$2"
                          borderTopWidth={1}
                          borderColor="$outline">
                          <VStack gap="$1">
                            <Text color="$typographySecondary" size="xs">
                              ID: {notification.identifier}
                            </Text>
                            <Text color="$typographySecondary" size="xs">
                              Category:{" "}
                              {(notification.content.data as { categoryId?: string } | undefined)
                                ?.categoryId || "N/A"}
                            </Text>
                            <Text color="$typographySecondary" size="xs">
                              Trigger: {notification.trigger.type}
                              {notification.trigger.type === "timeInterval"
                                ? ` (${notification.trigger.seconds}s)`
                                : ` (${new Date(notification.trigger.value).toLocaleString()})`}
                            </Text>
                            <Text color="$typographySecondary" size="xs">
                              Sound: {notification.content.sound || "default"}
                            </Text>
                          </VStack>
                        </Box>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          </ScrollView>

          {/* Footer */}
          <Box padding="$6" borderTopWidth={1} borderColor="$outline">
            <VStack gap="$2">
              <Text size="sm" color="$typographySecondary" textAlign="center">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </Text>
              <Button onPress={onClose} width="100%">
                <Button.Text>Close</Button.Text>
              </Button>
            </VStack>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default NotificationDebugModal;
