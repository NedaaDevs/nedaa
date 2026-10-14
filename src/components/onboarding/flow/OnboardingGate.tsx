import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { LANDING_MS, ONBOARDING_PART } from "@/constants/Onboarding";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const LANDING = { duration: LANDING_MS };
const NO_TOUCHES = { pointerEvents: "none" } as const;
const TRANSPARENT = 0;
const OPAQUE = 1;

type Props = { showOnboarding: boolean; children: ReactNode };

/** The flow during the first run, then the app, with one crossfade between. */
export const OnboardingGate = ({ showOnboarding, children }: Props) => {
  const reduced = useReducedMotion();
  const [shownBefore, setShownBefore] = useState(showOnboarding);
  const [leaving, setLeaving] = useState(false);
  // A new first run mounts a new flow, so none of the last run's state remains.
  const [run, setRun] = useState(0);
  // The first run ending starts the landing; adjusted while rendering.
  if (shownBefore !== showOnboarding) {
    setShownBefore(showOnboarding);
    setLeaving(!showOnboarding && !reduced);
    if (showOnboarding) setRun(run + 1);
  }
  const app = useSharedValue(TRANSPARENT);
  const flow = useSharedValue(OPAQUE);

  // Unread while the flow shows; reset so a later landing fades again.
  useEffect(() => {
    if (!showOnboarding) return;
    app.set(TRANSPARENT);
    flow.set(OPAQUE);
  }, [showOnboarding, app, flow]);

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
      {showOnboarding ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, appStyle, leaving && NO_TOUCHES]}>
          {children}
        </Animated.View>
      )}
      {showOnboarding || leaving ? (
        // The same slot either way, so the flow keeps its state while it fades.
        <Animated.View
          testID={ONBOARDING_PART.LANDING_FLOW}
          style={[StyleSheet.absoluteFill, flowStyle, leaving && NO_TOUCHES]}
          {...(leaving ? HIDDEN_FROM_READER : {})}>
          <OnboardingFlow key={run} leaving={leaving} />
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
