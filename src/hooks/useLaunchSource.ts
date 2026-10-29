import { useEffect, useState } from "react";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";

import { isAlarmScreenPath } from "@/constants/Alarm";
import { NATIVE_READ_TIMEOUT_MS } from "@/constants/Onboarding";

const SCHEME_END = "://";

/** A custom-scheme link's route path: `app://alarm?x=1` is `/alarm`. */
const linkPath = (url: string) => {
  const rest = url.slice(url.indexOf(SCHEME_END) + SCHEME_END.length);
  const [path = ""] = rest.split(/[?#]/);
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
};

type LaunchSource = { ready: boolean; launchedByAlert: boolean };

/** Whether a notification tap or an alarm link started this launch. */
export const useLaunchSource = (): LaunchSource => {
  // Read before useNotificationResponses handles the tap and clears it.
  const [tapped] = useState(() => Notifications.getLastNotificationResponse() !== null);
  const [alarmLink, setAlarmLink] = useState<boolean | null>(null);

  useEffect(() => {
    let settled = false;
    const settle = (fromAlarm: boolean) => {
      if (settled) return;
      settled = true;
      setAlarmLink(fromAlarm);
    };
    // A read with no answer counts as a launch with no link.
    const timer = setTimeout(() => settle(false), NATIVE_READ_TIMEOUT_MS);
    Linking.getInitialURL()
      .then((url) => settle(!!url && isAlarmScreenPath(linkPath(url))))
      .catch(() => settle(false));
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);

  return { ready: alarmLink !== null, launchedByAlert: tapped || alarmLink === true };
};
