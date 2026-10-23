import { Children, Fragment, isValidElement, type ReactNode } from "react";

import { Divider } from "@/components/ui/divider";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { VStack } from "@/components/ui/vstack";
import { ELEVATION_LEVEL } from "@/constants/Elevation";

/** Test ids for the group's parts. */
export const LIST_GROUP_PART = { DIVIDER: "list-group-divider" } as const;

type Props = { children: ReactNode; testID?: string };

/** Rows on one resting surface, a hairline between each. */
export const ListGroup = ({ children, testID }: Props) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  return (
    <VStack
      testID={testID}
      borderRadius="$card"
      backgroundColor="$surfaceGlass"
      overflow="hidden"
      style={{ boxShadow: lift }}>
      <HighlightEdge owner={testID} />
      {/* toArray drops the false and null a gated row leaves. */}
      {Children.toArray(children).map((row, index) => (
        // The row's own key, so removing a gated row leaves the rest mounted.
        <Fragment key={isValidElement(row) && row.key != null ? row.key : index}>
          {index > 0 ? <Divider testID={LIST_GROUP_PART.DIVIDER} /> : null}
          {row}
        </Fragment>
      ))}
    </VStack>
  );
};
