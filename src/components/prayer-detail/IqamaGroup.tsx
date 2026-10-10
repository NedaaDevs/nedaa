import { TimedAlertGroup } from "@/components/prayer-detail/TimedAlertGroup";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";

/** This prayer's Iqama reminder, set some minutes after the Athan. */
export const IqamaGroup = ({ prayerId }: { prayerId: PrayerId }) => (
  <TimedAlertGroup prayerId={prayerId} type={NOTIFICATION_TYPE.IQAMA} />
);
