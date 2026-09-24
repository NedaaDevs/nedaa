import { createContext, use, useEffect, useId, useRef, type ReactNode } from "react";
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

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

/** Text over the sky: a sun or moon behind it dims so the text stays legible. */
type OccluderProps = {
  children: ReactNode;
  /** Sizes the box to the text; a stretched box would dim over empty sky. */
  style?: StyleProp<ViewStyle>;
};

export const SkyOccluder = ({ children, style }: OccluderProps) => {
  const registry = use(SkyOccluderContext);
  const id = useId();
  const view = useRef<View>(null);
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
    <View ref={view} style={style} onLayout={measure}>
      {children}
    </View>
  );
};

type ScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** A scroll view over the sky: when it settles, its text measures again. */
export const SkyScrollView = (props: ScrollViewProps) => {
  const registry = use(SkyOccluderContext);
  const settled =
    (own: ScrollEnd | undefined): ScrollEnd =>
    (event) => {
      own?.(event);
      registry?.remeasure();
    };

  return (
    <ScrollView
      {...props}
      onScrollEndDrag={settled(props.onScrollEndDrag)}
      onMomentumScrollEnd={settled(props.onMomentumScrollEnd)}
    />
  );
};
