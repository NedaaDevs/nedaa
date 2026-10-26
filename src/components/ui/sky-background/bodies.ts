import { createContext, use, useLayoutEffect, useRef, useState } from "react";

/** Takes the page sky's sun and moon; the function returned gives them back. */
type ClaimBodies = () => () => void;

/** How a view that draws the page's sun or moon takes them from the sky. */
export const SkyBodiesContext = createContext<ClaimBodies | null>(null);

/** The sky's side: whether a view holds its bodies, and how one claims them. */
export const useSkyBodyClaims = () => {
  const [claims, setClaims] = useState({ count: 0, atMount: false });
  // Set after the children's layout effects; a claim before then is at mount.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [claim] = useState<ClaimBodies>(() => () => {
    const atMount = !mounted.current;
    setClaims(({ count }) => ({ count: count + 1, atMount }));
    return () => setClaims(({ count }) => ({ count: count - 1, atMount: false }));
  });
  return { claim, claimed: claims.count > 0, claimedAtOnce: claims.atMount };
};

/** While `active`, the page sky leaves its sun and moon to the caller. */
export const useClaimSkyBodies = (active: boolean) => {
  const claim = use(SkyBodiesContext);
  if (!claim) throw new Error("useClaimSkyBodies needs a SkyBackground above it");
  // A layout effect, so a view mounted with the sky claims before its paint.
  useLayoutEffect(() => (active ? claim() : undefined), [active, claim]);
};
