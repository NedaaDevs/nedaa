import { Skeleton } from "@/components/ui/skeleton";
import { RHYTHM_ARC_HEIGHT } from "@/constants/Timeline";

/** Test id of the placeholder the day's rhythm shows while its times load. */
export const TIMELINE_PART = { SKELETON: "timeline-skeleton" } as const;

/** The day's arc's place while its marks load, as tall as the arc. */
export const TimelineSkeleton = ({ label }: { label: string }) => (
  <Skeleton
    testID={TIMELINE_PART.SKELETON}
    accessible
    accessibilityLabel={label}
    style={{ height: RHYTHM_ARC_HEIGHT }}
  />
);
