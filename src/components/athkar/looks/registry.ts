import { CLASSIC_LOOK } from "@/components/athkar/looks/classic/look";
import type { AthkarLook } from "@/components/athkar/looks/types";
import { ATHKAR_LOOK, type AthkarLookId } from "@/constants/AthkarLook";

/** Every look by its id; a look with no entry fails the build. */
export const ATHKAR_LOOKS: Record<AthkarLookId, AthkarLook> = {
  [ATHKAR_LOOK.CLASSIC]: CLASSIC_LOOK,
};
