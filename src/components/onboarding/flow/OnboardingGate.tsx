import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  LANDING_MS,
  ONBOARDING_PART,
  ONBOARDING_PATH,
  type OnboardingPath,
} from "@/constants/Onboarding";
import { AppHiddenContext } from "@/contexts/AppHiddenContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/stores/app";

const LANDING = { duration: LANDING_MS };
const NO_TOUCHES = { pointerEvents: "none" } as const;
const TRANSPARENT = 0;
const OPAQUE = 1;

type Props = { path: OnboardingPath | null; children: ReactNode };

/** The flow during a walk, then the app, with one crossfade between. */
export const OnboardingGate = ({ path, children }: Props) => {
  const showOnboarding = path !== null;
  // The upgrade path covers a live app: an alarm can still navigate it.
  const appMounted = path !== ONBOARDING_PATH.FIRST_RUN;
  const markUpgradeShown = useAppStore((state) => state.markUpgradeShown);
  const reduced = useReducedMotion();
  const [shownBefore, setShownBefore] = useState(showOnboarding);
  // The walk the flow draws; it stays while the flow fades out.
  const [flowPath, setFlowPath] = useState(path);
  const [leaving, setLeaving] = useState(false);
  // A new walk mounts a new flow, so none of the last walk's state remains.
  const [run, setRun] = useState(0);
  // A walk ending starts the landing; adjusted while rendering.
  if (shownBefore !== showOnboarding) {
    setShownBefore(showOnboarding);
    setLeaving(!showOnboarding && !reduced);
    if (showOnboarding) setRun(run + 1);
  }
  if (path !== null && path !== flowPath) {
    setFlowPath(path);
    setRun(run + 1);
  }
  const app = useSharedValue(TRANSPARENT);
  const flow = useSharedValue(OPAQUE);

  // Unread while the flow shows; reset so a later landing fades again.
  useEffect(() => {
    if (!showOnboarding) return;
    app.set(TRANSPARENT);
    flow.set(OPAQUE);
  }, [showOnboarding, app, flow]);

  // What's New stays away for the rest of a launch that met the upgrade path.
  useEffect(() => {
    if (path === ONBOARDING_PATH.UPGRADE) markUpgradeShown();
  }, [path, markUpgradeShown]);

  const land = useEffectEvent(() => {
    app.set(withTiming(OPAQUE, LANDING));
    flow.set(withTiming(TRANSPARENT, LANDING));
    const timer = setTimeout(() => setLeaving(false), LANDING_MS);
    return () => clearTimeout(timer);
  });
  useEffect(() => (leaving ? land() : undefined), [leaving]);

  // Always attached, so a layer shows fully again the moment a landing stops.
  const appStyle = useAnimatedStyle(() => ({ opacity: leaving ? app.get() : OPAQUE }), [leaving]);
  const flowStyle = useAnimatedStyle(() => ({ opacity: leaving ? flow.get() : OPAQUE }), [leaving]);

  // Neither layer takes a touch while leaving: a second tap lands on nothing.
  return (
    <View style={styles.fill}>
      {appMounted ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, appStyle, (leaving || showOnboarding) && NO_TOUCHES]}
          {...(showOnboarding ? HIDDEN_FROM_READER : {})}>
          {/* The hidden app holds its sky and clocks still under the flow's. */}
          <AppHiddenContext value={showOnboarding}>{children}</AppHiddenContext>
        </Animated.View>
      ) : null}
      {flowPath !== null && (showOnboarding || leaving) ? (
        // The same slot either way, so the flow keeps its state while it fades.
        <Animated.View
          testID={ONBOARDING_PART.LANDING_FLOW}
          style={[StyleSheet.absoluteFill, flowStyle, leaving && NO_TOUCHES]}
          {...(leaving ? HIDDEN_FROM_READER : {})}>
          <OnboardingFlow key={run} path={flowPath} leaving={leaving} />
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
