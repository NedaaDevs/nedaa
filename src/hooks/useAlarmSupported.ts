import { useEffect, useState } from "react";

import { alarmSupport, knownAlarmSupport } from "@/utils/alarmSupport";

// False hides every alarm entry point: there an alarm turned on never fires.
export const useAlarmSupported = () => {
  const [supported, setSupported] = useState(() => knownAlarmSupport() ?? false);

  useEffect(() => {
    let active = true;
    void alarmSupport().then((available) => {
      if (active) setSupported(available);
    });
    return () => {
      active = false;
    };
  }, []);

  return supported;
};
