import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import type { AthkarLook } from "@/components/athkar/looks/types";
import { DEFAULT_ATHKAR_LOOK, type AthkarLookId } from "@/constants/AthkarLook";
import { useAthkarStore } from "@/stores/athkar";

/** The look a person chose for the Athkar reader; the default until they choose. */
export const useAthkarLookId = (): AthkarLookId =>
  useAthkarStore((state) => state.settings.look) ?? DEFAULT_ATHKAR_LOOK;

export const useAthkarLook = (): AthkarLook => ATHKAR_LOOKS[useAthkarLookId()];
