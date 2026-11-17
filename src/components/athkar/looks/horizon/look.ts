import { HorizonFocus } from "@/components/athkar/looks/horizon/HorizonFocus";
import { HorizonReader } from "@/components/athkar/looks/horizon/HorizonReader";
import type { AthkarLook } from "@/components/athkar/looks/types";

/** The Horizon look: the dhikr on the open sky, its count as a sun. */
export const HORIZON_LOOK: AthkarLook = {
  name: "athkar.look.name.horizon",
  Reader: HorizonReader,
  drawsSun: true,
  Focus: HorizonFocus,
};
