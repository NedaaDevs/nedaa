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

// Icons
import { XIcon } from "lucide-react-native";

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

export const NotificationDebugModal: FC<Props> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);

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
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Box className="flex-1 bg-transparent items-center justify-end p-4">
        <Box className="bg-background-secondary rounded-t-3xl w-full max-h-[85vh] min-h-[70vh]">
          {/* Header */}
          <HStack className="justify-between items-center p-6 border-b border-outline">
            <Text className="text-xl font-semibold text-typography">Scheduled Notifications</Text>
            <Pressable className="p-2 rounded-md" onPress={onClose}>
              <XIcon size={24} className="text-typography-secondary" />
            </Pressable>
          </HStack>

          {/* Content */}
          <ScrollView className="flex-1 px-6">
            <Box className="py-6">
              {notifications.length === 0 ? (
                <Text className="text-typography text-center">
                  No scheduled notifications found
                </Text>
              ) : (
                <VStack space="lg">
                  {notifications.map((notification, index) => (
                    <Box key={index} className="bg-background p-4 rounded-xl">
                      <VStack space="sm">
                        <Text className="text-typography font-semibold">
                          ID: {notification.identifier}
                        </Text>
                        <Text className="text-typography-secondary">
                          Title: {notification.content.title}
                        </Text>
                        <Text className="text-typography-secondary">
                          Body: {notification.content.body}
                        </Text>
                        <Text className="text-typography-secondary">
                          Category:{" "}
                          {(notification.content.data as { categoryId?: string } | undefined)
                            ?.categoryId || "N/A"}
                        </Text>
                        <Text className="text-typography-secondary">
                          Trigger Type: {notification.trigger.type}
                        </Text>
                        <Text className="text-typography-secondary">
                          {notification.trigger.type === "timeInterval"
                            ? `Seconds: ${notification.trigger.seconds}`
                            : `Value: ${notification.trigger.value}`}
                        </Text>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          </ScrollView>

          {/* Footer */}
          <Box className="p-6 border-t border-outline">
            <Button onPress={onClose} className="w-full bg-primary">
              <ButtonText className="text-typography-contrast">Close</ButtonText>
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default NotificationDebugModal;
