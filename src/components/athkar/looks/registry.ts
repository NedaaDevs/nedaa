import { CLASSIC_LOOK } from "@/components/athkar/looks/classic/look";
import { HORIZON_LOOK } from "@/components/athkar/looks/horizon/look";
import { SUBHA_LOOK } from "@/components/athkar/looks/subha/look";
import type { AthkarLook } from "@/components/athkar/looks/types";
import { ATHKAR_LOOK, type AthkarLookId } from "@/constants/AthkarLook";

/** Every look by its id; a look with no entry fails the build. */
export const ATHKAR_LOOKS: Record<AthkarLookId, AthkarLook> = {
  [ATHKAR_LOOK.CLASSIC]: CLASSIC_LOOK,
  [ATHKAR_LOOK.HORIZON]: HORIZON_LOOK,
  [ATHKAR_LOOK.SUBHA]: SUBHA_LOOK,
};
