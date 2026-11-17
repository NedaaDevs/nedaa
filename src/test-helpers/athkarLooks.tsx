import { Pressable, Text } from "react-native";
import type { ParseKeys } from "i18next";

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
  TRYING: "test-look-trying",
} as const;

/** No locale holds it, so it draws as written, and is cast into the keys. */
export const TEST_LOOK_NAME = "Test look" as ParseKeys;

const Reader = ({ session, trying }: AthkarLookProps) => (
  <Pressable testID={TEST_LOOK_PART.READER} onPress={session.add}>
    <Text testID={TEST_LOOK_PART.COUNT}>{session.current?.count}</Text>
    {trying ? <Text testID={TEST_LOOK_PART.TRYING}>trying</Text> : null}
  </Pressable>
);

const Focus = ({ close }: AthkarFocusProps) => (
  <>
    {close}
    <Text testID={TEST_LOOK_PART.FOCUS}>focus</Text>
  </>
);

export const TEST_LOOK: AthkarLook = { name: TEST_LOOK_NAME, Reader, Focus };

/** The registry with the test look beside the real ones, for `jest.mock`. */
export const registryWithTestLook = () => {
  const actual = jest.requireActual<typeof import("@/components/athkar/looks/registry")>(
    "@/components/athkar/looks/registry"
  );
  return { ...actual, ATHKAR_LOOKS: { ...actual.ATHKAR_LOOKS, [TEST_LOOK_ID]: TEST_LOOK } };
};

/** The look constants with the test look offered after the real ones, for `jest.mock`. */
export const lookConstantsWithTestLook = () => {
  const actual =
    jest.requireActual<typeof import("@/constants/AthkarLook")>("@/constants/AthkarLook");
  const ids = [...actual.ATHKAR_LOOK_IDS, TEST_LOOK_ID];
  return {
    ...actual,
    ATHKAR_LOOK_IDS: ids,
    isAthkarLookId: (value: unknown) => ids.some((id) => id === value),
  };
};
