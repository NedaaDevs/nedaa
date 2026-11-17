import { SubhaFocus } from "@/components/athkar/looks/subha/SubhaFocus";
import { SubhaReader } from "@/components/athkar/looks/subha/SubhaReader";
import type { AthkarLook } from "@/components/athkar/looks/types";

/** The Subha look: the dhikr on a glass slab, its count as beads. */
export const SUBHA_LOOK: AthkarLook = {
  name: "athkar.look.name.subha",
  Reader: SubhaReader,
  drawsSun: false,
  Focus: SubhaFocus,
};
