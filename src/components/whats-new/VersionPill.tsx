import { Pill } from "@/components/ui/pill";
import { appVersion } from "@/utils/appVersion";
import { LTR_ISOLATE } from "@/utils/digits";

/** Test id for the pill's frame. */
export const VERSION_PILL_ID = "version-pill";

/** The installed release, such as 2.10.8, left to right in every language. */
export const VersionPill = () => (
  <Pill testID={VERSION_PILL_ID}>{`${LTR_ISOLATE.OPEN}${appVersion()}${LTR_ISOLATE.CLOSE}`}</Pill>
);
