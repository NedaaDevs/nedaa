import { FC, useState, useEffect } from "react";
import type { NotificationContent } from "expo-notifications";
import { ScrollView } from "react-native";

// Utils
import { listScheduledNotifications } from "@/utils/notifications";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { Badge, BadgeText } from "@/components/ui/badge";

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
      <Box className="flex-1 bg-transparent items-center justify-end p-4">
        <Box className="bg-background-secondary rounded-t-3xl w-full max-h-[85vh] min-h-[70vh]">
          {/* Header */}
          <Box className="p-6 border-b border-outline">
            <HStack className="justify-between items-center mb-4">
              <Text className="text-xl font-semibold text-typography">Scheduled Notifications</Text>
              <Pressable className="p-2 rounded-md" onPress={onClose}>
                <XIcon size={24} className="text-typography-secondary" />
              </Pressable>
            </HStack>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
              <HStack space="xs" className="pr-2">
                {filterButtons.map((btn) => (
                  <Pressable
                    key={btn.key}
                    onPress={() => setFilter(btn.key)}
                    className={`px-3 py-1.5 rounded-lg ${
                      filter === btn.key ? "bg-primary" : "bg-background-muted"
                    }`}>
                    <Text
                      className={`text-sm font-medium ${
                        filter === btn.key ? "text-background" : "text-typography"
                      }`}>
                      {btn.label} ({btn.count})
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </ScrollView>
          </Box>

          {/* Content */}
          <ScrollView className="flex-1 px-6">
            <Box className="py-6">
              {filteredNotifications.length === 0 ? (
                <Text className="text-typography text-center">
                  {notifications.length === 0
                    ? "No scheduled notifications found"
                    : `No ${filter} notifications found`}
                </Text>
              ) : (
                <VStack space="lg">
                  {filteredNotifications.map((notification, index) => (
                    <Box key={index} className="bg-background p-4 rounded-xl border border-outline">
                      <VStack space="sm">
                        <HStack className="justify-between items-center mb-1">
                          <Text className="text-typography font-semibold text-xs">
                            #{index + 1}
                          </Text>
                          <Badge size="sm" variant="outline">
                            <BadgeText className="text-xs">
                              {getNotificationType(notification)}
                            </BadgeText>
                          </Badge>
                        </HStack>
                        <Text className="text-typography font-semibold">
                          {notification.content.title}
                        </Text>
                        <Text className="text-typography-secondary text-sm">
                          {notification.content.body}
                        </Text>
                        <Box className="mt-2 pt-2 border-t border-outline">
                          <VStack space="xs">
                            <Text className="text-typography-secondary text-xs">
                              ID: {notification.identifier}
                            </Text>
                            <Text className="text-typography-secondary text-xs">
                              Category:{" "}
                              {(notification.content.data as { categoryId?: string } | undefined)
                                ?.categoryId || "N/A"}
                            </Text>
                            <Text className="text-typography-secondary text-xs">
                              Trigger: {notification.trigger.type}
                              {notification.trigger.type === "timeInterval"
                                ? ` (${notification.trigger.seconds}s)`
                                : ` (${new Date(notification.trigger.value).toLocaleString()})`}
                            </Text>
                            <Text className="text-typography-secondary text-xs">
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
          <Box className="p-6 border-t border-outline">
            <VStack space="sm">
              <Text className="text-sm text-typography-secondary text-center">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </Text>
              <Button onPress={onClose} className="w-full bg-primary">
                <ButtonText className="text-typography-contrast">Close</ButtonText>
              </Button>
            </VStack>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default NotificationDebugModal;
