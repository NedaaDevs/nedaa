import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getSnoozeQueue } from "expo-alarm";

import { NATIVE_READ_TIMEOUT_MS } from "@/constants/Onboarding";
import { PlatformType } from "@/enums/app";
import { isAlarmLink } from "@/utils/alarmLink";

const alarmLinkLaunch = async () => {
  const url = await Linking.getInitialURL();
  return !!url && isAlarmLink(url);
};

// The Android overlay opens the app with no link after a snooze. The queue
// drains only in the app shell, which mounts after this read.
const snoozeLaunch = async () =>
  Platform.OS === PlatformType.ANDROID && (await getSnoozeQueue()).length > 0;

/** A failed read counts as no alert. */
const orNo = (read: Promise<boolean>) => read.catch(() => false);

type LaunchSource = { ready: boolean; launchedByAlert: boolean };

/** Whether a notification tap or an alarm started this launch. */
export const useLaunchSource = (): LaunchSource => {
  // Read before useNotificationResponses handles the tap and clears it.
  const [tapped] = useState(() => Notifications.getLastNotificationResponse() !== null);
  const [alarmLaunch, setAlarmLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    let settled = false;
    const settle = (fromAlarm: boolean) => {
      if (settled) return;
      settled = true;
      setAlarmLaunch(fromAlarm);
    };
    // A read with no answer counts as a launch with no link.
    const timer = setTimeout(() => settle(false), NATIVE_READ_TIMEOUT_MS);
    void Promise.all([orNo(alarmLinkLaunch()), orNo(snoozeLaunch())]).then(([link, snooze]) =>
      settle(link || snooze)
    );
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);

  return { ready: alarmLaunch !== null, launchedByAlert: tapped || alarmLaunch === true };
};
