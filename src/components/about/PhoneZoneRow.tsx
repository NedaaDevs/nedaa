import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Globe } from "lucide-react-native";

import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { APP_STATE } from "@/constants/AppState";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useHaptic } from "@/hooks/useHaptic";
import { phoneZoneReadings } from "@/utils/phoneZone";

type Reading = ReturnType<typeof phoneZoneReadings> & { at: string };

const read = (): Reading => ({ ...phoneZoneReadings(), at: new Date().toLocaleTimeString() });

export const phoneZoneStatus = ({ intl, calendar, at }: Reading) =>
  `Intl ${intl ?? DEBUG_COPY.NO_ZONE} · Calendar ${calendar ?? DEBUG_COPY.NO_ZONE} · ${at}`;

/** Both phone-zone sources, read again on a tap and on each return to the app. */
export const PhoneZoneRow = () => {
  const selectionHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const [reading, setReading] = useState(read);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === APP_STATE.ACTIVE) setReading(read());
    });
    return () => subscription.remove();
  }, []);

  const refresh = async () => {
    await selectionHaptic();
    setReading(read());
  };

  return (
    <ListRow
      variant={LIST_ROW_VARIANT.GROUPED}
      icon={Globe}
      title={DEBUG_COPY.PHONE_ZONE}
      status={phoneZoneStatus(reading)}
      hint={DEBUG_COPY.PHONE_ZONE_HINT}
      wrapStatus
      onPress={refresh}
    />
  );
};
