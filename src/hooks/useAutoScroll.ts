import { useCallback, useEffect } from "react";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

// Continuous "teleprompter" glide for a vertical list: each frame (UI thread)
// advances an independent `target` by pxPerSec × frame time and scrollTo()s there.
//
// Hands-free — a drag only pauses the glide while touched (the loop follows the
// finger via `interacting`), then resumes from the new position; only the pause
// button or the end stops it.
//
// `target` is never written from the scroll event: that event lags on Android
// (pre-scroll offset), which drove the glide backward. `liveOffset` mirrors the
// real position for seeding/following.
//
// Attach `animatedRef` + `scrollHandler` to an Animated.FlatList (scrollEventThrottle=16).

type Params = {
  playing: boolean;
  pxPerSec: number;
  // The list offset of the current page — used to seed the glide when the list
  // was just mounted (e.g. a layout switch) and its live offset is still 0, so the
  // glide starts from the page you're on rather than dragging back to the top.
  // Omit when item heights are unknown (variable-height text reader).
  initialOffset?: number;
  onReachEnd: () => void;
};

export const useAutoScroll = <ItemT>({
  playing,
  pxPerSec,
  initialOffset = 0,
  onReachEnd,
}: Params) => {
  const animatedRef = useAnimatedRef<Animated.FlatList<ItemT>>();
  const target = useSharedValue(0);
  const liveOffset = useSharedValue(0);
  const contentH = useSharedValue(0);
  const layoutH = useSharedValue(0);
  const speed = useSharedValue(pxPerSec);
  const interacting = useSharedValue(false);
  // Ceiling for the glide (UI thread). While read-along follow drives the view the
  // reader sets this to 0, parking the creep entirely (follow moves the list with
  // its own discrete glides); MAX = uncapped normal teleprompter.
  const maxOffset = useSharedValue(Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    speed.set(pxPerSec);
  }, [pxPerSec, speed]);

  const scrollHandler = useAnimatedScrollHandler({
    // Mirror the real position + extent for seeding/following — never drives the loop.
    onScroll: (e) => {
      liveOffset.set(e.contentOffset.y);
      contentH.set(e.contentSize.height);
      layoutH.set(e.layoutMeasurement.height);
    },
    // A touch (drag + any fling) suspends the glide; releasing resumes. Fire only
    // on real user interaction, not our scrollTo.
    onBeginDrag: () => {
      interacting.set(true);
    },
    onEndDrag: () => {
      interacting.set(false);
    },
    onMomentumBegin: () => {
      interacting.set(true);
    },
    onMomentumEnd: () => {
      interacting.set(false);
    },
  });

  const frame = useFrameCallback((f) => {
    // While the user is touching, follow their scroll so the glide picks up from
    // the new position on release — don't drive against them.
    if (interacting.get()) {
      target.set(liveOffset.get());
      return;
    }
    const dt = (f.timeSincePreviousFrame ?? 16) / 1000;
    // Park at the read-along ceiling (0 while follow drives); resumes when lifted.
    const next = Math.min(target.get() + speed.get() * dt, maxOffset.get());
    // Clamp/stop only once we actually know the scrollable extent; until then
    // (before the first scroll event) just keep gliding so play can start.
    const max = contentH.get() - layoutH.get();
    if (max > 0 && next >= max) {
      target.set(max);
      scrollTo(animatedRef, 0, max, false);
      scheduleOnRN(onReachEnd);
      return;
    }
    if (next <= target.get()) return; // parked at the cap — hold position
    target.set(next);
    scrollTo(animatedRef, 0, next, false);
  }, false);

  // Seed the driver from the reader's actual position at play-start (so a resume
  // continues in place), then run the loop only while playing. The seed runs in a
  // UI worklet — writing a shared value off-render.
  useEffect(() => {
    if (playing) {
      scheduleOnUI(() => {
        // A just-mounted list reports liveOffset 0 before its first scroll event;
        // fall back to the current page's offset so the glide doesn't start at the top.
        target.set(liveOffset.get() === 0 && initialOffset > 0 ? initialOffset : liveOffset.get());
      });
    }
    frame.setActive(playing);
  }, [playing, frame, target, liveOffset, initialOffset]);

  // Jump the list AND the glide to an absolute offset. External navigation (search,
  // sync-to-recited) must move `target` too, or the frame loop drags the view back.
  const jumpTo = useCallback(
    (offset: number) => {
      scheduleOnUI(() => {
        target.set(offset);
        scrollTo(animatedRef, 0, offset, false);
      });
    },
    [animatedRef, target]
  );

  // Re-seed the glide from the list's real position — for index-based jumps whose
  // pixel offset isn't knowable up front (variable-height text pages).
  const syncToLive = useCallback(() => {
    scheduleOnUI(() => {
      target.set(liveOffset.get());
    });
  }, [liveOffset, target]);

  // liveOffset/layoutH are exposed so a follower (read-along) can decide, on the UI
  // thread, whether the target line is already on screen before scrolling to it;
  // maxOffset is the read-along ceiling the follower raises as recitation advances;
  // glideTarget lets a follower's own scroll keep the glide in step.
  return {
    animatedRef,
    scrollHandler,
    liveOffset,
    layoutH,
    maxOffset,
    glideTarget: target,
    jumpTo,
    syncToLive,
  };
};
