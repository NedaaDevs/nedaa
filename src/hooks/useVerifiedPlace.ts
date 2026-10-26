import { TIMES_PLACE } from "@/constants/Location";
import { useTimesPlace } from "@/hooks/useTimesPlace";

/** Whether the stored times are a verified place's; false until both load. */
export const useVerifiedPlace = (): boolean => useTimesPlace() === TIMES_PLACE.VERIFIED;
