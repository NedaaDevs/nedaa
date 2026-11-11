import { Skeleton } from "@/components/ui/skeleton";
import { BOWL } from "@/constants/Timeline";

/** Test id of the placeholder the bowl shows while its times load. */
export const TIMELINE_PART = { SKELETON: "timeline-skeleton" } as const;

/** The bowl's place while the day's times load, as tall as the bowl. */
export const TimelineSkeleton = ({ label }: { label: string }) => (
  <Skeleton
    testID={TIMELINE_PART.SKELETON}
    accessible
    accessibilityLabel={label}
    style={{ height: BOWL.leastHeight }}
  />
);
