import type { AthkarSession } from "@/hooks/useAthkarSession";

/** What every look of the Athkar reader is given. A look draws; it holds no session state. */
export type AthkarLookProps = {
  session: AthkarSession;
  onOpenList: () => void;
  onOpenFocus: () => void;
  onStartAudio: () => void;
};
