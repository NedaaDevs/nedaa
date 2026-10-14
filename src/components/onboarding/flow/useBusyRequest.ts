import { useRef, useState } from "react";

import type { StepProps } from "@/components/onboarding/flow/types";

/** One request at a time; the frame stays busy until it settles. */
export const useBusyRequest = (setBusy: StepProps["setBusy"]) => {
  // The ref is the synchronous double-tap guard; the state is what is drawn.
  const running = useRef(false);
  const [requesting, setRequesting] = useState(false);

  const request = (work: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setRequesting(true);
    setBusy(true);
    // A promise `finally`: the React Compiler cannot compile a finally clause.
    void work().finally(() => {
      // Also after the step left: the flow holds busy until it is cleared.
      running.current = false;
      setRequesting(false);
      setBusy(false);
    });
  };

  return { request, requesting };
};
