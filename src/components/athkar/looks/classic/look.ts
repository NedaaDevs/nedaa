import { ClassicFocus } from "@/components/athkar/looks/classic/ClassicFocus";
import { ClassicGround } from "@/components/athkar/looks/classic/ClassicGround";
import { ClassicReader } from "@/components/athkar/looks/classic/ClassicReader";
import type { AthkarLook } from "@/components/athkar/looks/types";

/** The Classic look: its reader, its Focus stage and the ground under it. */
export const CLASSIC_LOOK: AthkarLook = {
  name: "athkar.look.name.classic",
  Reader: ClassicReader,
  drawsSun: false,
  Focus: ClassicFocus,
  FocusGround: ClassicGround,
};
