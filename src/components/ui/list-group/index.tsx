import { Children, Fragment, isValidElement, type ReactNode } from "react";

import { Divider } from "@/components/ui/divider";
import { VStack } from "@/components/ui/vstack";

/** Test ids for the group's parts. */
export const LIST_GROUP_PART = { DIVIDER: "list-group-divider" } as const;

type Props = { children: ReactNode; testID?: string };

/** Rows in one bordered card, a rule between each. */
export const ListGroup = ({ children, testID }: Props) => (
  <VStack
    testID={testID}
    borderWidth={1}
    borderColor="$border"
    borderRadius="$card"
    backgroundColor="$surface2"
    overflow="hidden">
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
