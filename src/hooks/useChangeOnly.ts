import { useState } from "react";

/** Says each change after the first; focus reads what mounts. */
export const useChangeOnly = (message: string | null): string | null => {
  const [opening, setOpening] = useState<string | null>(message);
  if (opening !== null && opening !== message) setOpening(null);
  return opening === null ? message : null;
};
