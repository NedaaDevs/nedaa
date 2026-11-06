import { createContext, use, useEffect, useId, useRef, type ReactNode } from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewInstance,
  type ViewProps,
} from "react-native";

import { SCREEN_GUTTER, ScreenGutterContext } from "@/components/ui/screen-content";
import { measureInWindow } from "@/utils/measureInWindow";
import type { WindowRect } from "@/utils/sky";

type Registry = {
  /** A block's box in window points; null takes it off the sky. */
  report: (id: string, box: WindowRect | null) => void;
  /** Changes whenever content has moved over the sky. */
  epoch: number;
  remeasure: () => void;
};

export const SkyOccluderContext = createContext<Registry | null>(null);

type OccluderProps = {
  children: ReactNode;
  /** Sizes the box to the text; a stretched box would dim over empty sky. */
  style?: ViewProps["style"];
  testID?: ViewProps["testID"];
};

/** Text over the sky: a sun or moon behind it dims, so the text reads. */
export const SkyOccluder = ({ children, style, testID }: OccluderProps) => {
  const registry = use(SkyOccluderContext);
  const id = useId();
  const view = useRef<ViewInstance>(null);
  const report = registry?.report;
  const epoch = registry?.epoch;

  const measure = () => {
    if (report) void measureInWindow(view.current).then((box) => report(id, box));
  };

  useEffect(() => {
    if (!report) return;
    void measureInWindow(view.current).then((box) => report(id, box));
  }, [report, epoch, id]);

  useEffect(() => () => report?.(id, null), [report, id]);

  return (
    <View ref={view} testID={testID} style={style} onLayout={measure}>
      {children}
    </View>
  );
};

/** Over the sky: its text re-measures when it settles or moves. */
export const SkyScrollView = (props: ScrollViewProps) => {
  const registry = use(SkyOccluderContext);
  // Content above can move the whole view without moving any block within its
  // parent, so no block's own layout event fires.
  const settled =
    <Args extends unknown[]>(own: ((...args: Args) => void) | undefined) =>
    (...args: Args) => {
      own?.(...args);
      registry?.remeasure();
    };

  return (
    // A screen on the sky sets its header in the screen gutter.
    <ScreenGutterContext value={SCREEN_GUTTER}>
      <ScrollView
        {...props}
        onScrollEndDrag={settled(props.onScrollEndDrag)}
        onMomentumScrollEnd={settled(props.onMomentumScrollEnd)}
        onLayout={settled(props.onLayout)}
        onContentSizeChange={settled(props.onContentSizeChange)}
      />
    </ScreenGutterContext>
  );
};
