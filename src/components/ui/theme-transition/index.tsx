import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { Animated, AppState, Easing, Image, StyleSheet, View } from "react-native";
import { captureRef, releaseCapture, type CaptureOptions } from "react-native-view-shot";

import {
  ThemeDissolvingContext,
  ThemeTransitionContext,
  type WithThemeTransition,
} from "@/components/ui/theme-transition/context";
import { APP_STATE } from "@/constants/AppState";
import { DISSOLVE_CURVE, DURATION_MS } from "@/constants/Motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AppLogger } from "@/utils/appLogger";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

const log = AppLogger.create("app");
const TAG = "theme-transition";

/** Test ids for the dissolve's views; the screen reader sees neither. */
export const DISSOLVE_PART = {
  OVERLAY: "theme-dissolve-overlay",
  SNAPSHOT: "theme-dissolve-snapshot",
} as const;

// JPEG encodes faster than PNG and the root is opaque; a file path
// keeps megabytes of base64 off the JS thread.
const SNAPSHOT: CaptureOptions = { format: "jpg", quality: 0.9, result: "tmpfile" };

/** How long a capture may take before the change runs uncovered. */
const CAPTURE_LIMIT_MS = 400;

/** How long a snapshot may take to show before the change runs uncovered. */
const SNAPSHOT_SHOW_LIMIT_MS = 500;

type Change = Parameters<WithThemeTransition>[0];

type Shown = { resolve: () => void; reject: (error: Error) => void };

/**
 * A dissolve in progress. `changes` chains each change run under its cover,
 * and is null once all have run; `done` settles once the cover is gone.
 */
type Flight = { changes: Promise<void> | null; done: Promise<void> };

/** The provider's refs, setters and opacity, which a dissolve drives. */
type DissolveHandles = {
  root: RefObject<View | null>;
  opacity: Animated.Value;
  flight: RefObject<Flight | null>;
  shown: RefObject<Shown | null>;
  onCommit: RefObject<(() => void) | null>;
  setCommits: Dispatch<SetStateAction<number>>;
  setSnapshot: Dispatch<SetStateAction<string | null>>;
  reduced: boolean;
};

const ignore = () => {};

const isActive = () => AppState.currentState === APP_STATE.ACTIVE;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** `work`, or a rejection with `reason` once `ms` pass first. */
const withinLimit = <T,>(work: Promise<T>, ms: number, reason: string): Promise<T> => {
  let limit: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    limit = setTimeout(() => reject(new Error(reason)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(limit));
};

/** Lays the old screen over the app; its file, or null when it cannot. */
const cover = async (h: DissolveHandles, away: Promise<never>): Promise<string | null> => {
  const capture = captureRef(h.root, SNAPSHOT);
  let uri: string | null = null;
  try {
    uri = await Promise.race([withinLimit(capture, CAPTURE_LIMIT_MS, "capture timed out"), away]);
    h.opacity.setValue(1);
    const showing = new Promise<void>((resolve, reject) => {
      h.shown.current = { resolve, reject };
    });
    h.setSnapshot(uri);
    await Promise.race([
      withinLimit(showing, SNAPSHOT_SHOW_LIMIT_MS, "snapshot never showed"),
      away,
    ]);
    await Promise.race([nextFrame(), away]);
    return uri;
  } catch (error) {
    log.w(TAG, `Theme change runs without a dissolve: ${String(error)}`);
    if (uri) releaseCapture(uri);
    // A capture that lands after the limit is released when it does.
    else capture.then(releaseCapture, ignore);
    return null;
  } finally {
    h.shown.current = null;
  }
};

/** Settles once React has committed the render the change asked for. */
const committed = (h: DissolveHandles) =>
  new Promise<void>((resolve) => {
    h.onCommit.current = resolve;
    h.setCommits((count) => count + 1);
  });

const fade = (h: DissolveHandles) =>
  new Promise<void>((resolve) => {
    Animated.timing(h.opacity, {
      toValue: 0,
      duration: DURATION_MS.DISSOLVE,
      easing: Easing.bezier(...DISSOLVE_CURVE),
      useNativeDriver: true,
    }).start(() => resolve());
  });

/** Shows the new screen by fading the snapshot off it. */
const reveal = async (h: DissolveHandles) => {
  await committed(h);
  await nextFrame();
  await fade(h);
};

/** Runs every change queued under the cover, then marks the flight switched. */
const runQueued = async (flight: Flight) => {
  let last: Promise<void> | null;
  do {
    last = flight.changes;
    await last;
  } while (last !== flight.changes);
  flight.changes = null;
};

/** Runs `fn` under a dissolve: joins one whose changes are still running. */
const runDissolve = async (h: DissolveHandles, fn: Change): Promise<void> => {
  const running = h.flight.current;
  if (running) {
    // Away from the foreground nothing is drawn, so the change runs at once.
    if (!isActive()) return fn();
    if (running.changes) {
      const change = running.changes.then(() => fn());
      running.changes = change.catch(ignore);
      return change;
    }
    await running.done;
    return runDissolve(h, fn);
  }
  if (h.reduced || !isActive()) return fn();

  let finish = ignore;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let leave = ignore;
  const away = new Promise<never>((_, reject) => {
    leave = () => reject(new Error("app left the foreground"));
  });
  away.catch(ignore);
  // Leaving the foreground ends the dissolve: the change runs, the cover goes.
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === APP_STATE.ACTIVE) return;
    h.opacity.stopAnimation();
    h.setSnapshot(null);
    leave();
  });

  const covered = cover(h, away);
  const own = covered.then(() => fn());
  const flight: Flight = { changes: own.catch(ignore), done };
  h.flight.current = flight;
  let uri: string | null = null;
  try {
    uri = await covered;
    await runQueued(flight);
    await own;
    // Leaving the foreground cuts the reveal short; the cover is cleared below.
    if (uri) await Promise.race([reveal(h), away]).catch(ignore);
  } finally {
    subscription.remove();
    h.flight.current = null;
    h.setSnapshot(null);
    if (uri) releaseCapture(uri);
    finish();
  }
};

/** Holds the whole UI so a theme change shows as the old screen fading off. */
export const ThemeTransitionProvider = ({ children }: { children: ReactNode }) => {
  const root = useRef<View>(null);
  // A screenshot build captures settled screens, so it never dissolves.
  const reduced = useReducedMotion() || IS_SCREENSHOT_MODE;
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));
  const flight = useRef<Flight | null>(null);
  const shown = useRef<Shown | null>(null);

  // Settles a dissolve's wait once React has committed its change.
  const [commits, setCommits] = useState(0);
  const onCommit = useRef<(() => void) | null>(null);
  useEffect(() => {
    onCommit.current?.();
    onCommit.current = null;
  }, [commits]);

  const withThemeTransition: WithThemeTransition = (fn) =>
    runDissolve({ root, opacity, flight, shown, onCommit, setCommits, setSnapshot, reduced }, fn);

  return (
    <ThemeTransitionContext value={withThemeTransition}>
      <ThemeDissolvingContext value={snapshot !== null}>
        <View style={styles.fill}>
          {/* Android drops a layout-only view, leaving nothing to capture. */}
          <View ref={root} collapsable={false} style={styles.fill}>
            {children}
          </View>
          {snapshot && (
            <Animated.View
              testID={DISSOLVE_PART.OVERLAY}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[StyleSheet.absoluteFill, { opacity }]}>
              <Image
                testID={DISSOLVE_PART.SNAPSHOT}
                source={{ uri: snapshot }}
                fadeDuration={0}
                style={StyleSheet.absoluteFill}
                onLoad={() => shown.current?.resolve()}
                onError={({ nativeEvent }) => shown.current?.reject(new Error(nativeEvent.error))}
              />
            </Animated.View>
          )}
        </View>
      </ThemeDissolvingContext>
    </ThemeTransitionContext>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
