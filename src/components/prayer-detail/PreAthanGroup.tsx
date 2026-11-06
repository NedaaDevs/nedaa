import { TimedAlertGroup } from "@/components/prayer-detail/TimedAlertGroup";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";

/** This prayer's pre-Athan reminder, set some minutes before the Athan. */
export const PreAthanGroup = ({ prayerId }: { prayerId: PrayerId }) => (
  <TimedAlertGroup prayerId={prayerId} type={NOTIFICATION_TYPE.PRE_ATHAN} />
);
