import { Pressable, Text } from "react-native";

import type {
  AthkarFocusProps,
  AthkarLook,
  AthkarLookProps,
} from "@/components/athkar/looks/types";
import type { AthkarLookId } from "@/constants/AthkarLook";

/** A second look for tests. No build ships it, so its id is cast into the union. */
export const TEST_LOOK_ID = "test-look" as AthkarLookId;

export const TEST_LOOK_PART = {
  READER: "test-look-reader",
  COUNT: "test-look-count",
  FOCUS: "test-look-focus",
} as const;

const Reader = ({ session }: AthkarLookProps) => (
  <Pressable testID={TEST_LOOK_PART.READER} onPress={session.add}>
    <Text testID={TEST_LOOK_PART.COUNT}>{session.current?.count}</Text>
  </Pressable>
);

const Focus = ({ close }: AthkarFocusProps) => (
  <>
    {close}
    <Text testID={TEST_LOOK_PART.FOCUS}>focus</Text>
  </>
);

export const TEST_LOOK: AthkarLook = { Reader, Focus };

/** The registry with the test look beside the real ones, for `jest.mock`. */
export const registryWithTestLook = () => {
  const actual = jest.requireActual<typeof import("@/components/athkar/looks/registry")>(
    "@/components/athkar/looks/registry"
  );
  return { ...actual, ATHKAR_LOOKS: { ...actual.ATHKAR_LOOKS, [TEST_LOOK_ID]: TEST_LOOK } };
};
