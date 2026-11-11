import { useRef, useState, type ReactNode } from "react";
import { useWindowDimensions, type LayoutChangeEvent, type ViewInstance } from "react-native";

import { Background } from "@/components/ui/background";
import { SkyBodiesContext, useSkyBodyClaims } from "@/components/ui/sky-background/bodies";
import {
  SkyOccluder,
  SkyOccluderContext,
  SkyScrollView,
} from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { useBodyOpacity } from "@/components/ui/sky-background/useBodyOpacity";
import { LiveSkyContext, useLiveSky } from "@/components/ui/sky-background/useLiveSky";
import { useScreenLive } from "@/hooks/useScreenLive";
import { measureInWindow } from "@/utils/measureInWindow";
import type { WindowRect } from "@/utils/sky";

export { SKY_PART, SkyOccluder, SkyScrollView };

type Props = {
  children?: ReactNode;
  /** Holds the sky still while its screen is out of focus. */
  paused?: boolean;
};

/** The screen surface: the sky for the current brightness, phase and hour. */
export const SkyBackground = ({ children, paused = false }: Props) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const sky = useLiveSky();
  const { scene, celestial, hijriDay, isRTL, reduced } = sky;

  // Text blocks over the sky, in window points, and where the sky itself sits.
  const [boxes, setBoxes] = useState<Record<string, WindowRect>>({});
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [epoch, setEpoch] = useState(0);
  const canvas = useRef<ViewInstance>(null);
  // Stable, and a no-op for an unchanged box: measuring never loops a render.
  const [report] = useState(
    () => (id: string, box: WindowRect | null) =>
      setBoxes((current) => {
        const old = current[id];
        if (!box) {
          return old
            ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))
            : current;
        }
        const same =
          old && (Object.keys(box) as (keyof WindowRect)[]).every((k) => old[k] === box[k]);
        return same ? current : { ...current, [id]: box };
      })
  );
  const registry = { report, epoch, remeasure: () => setEpoch((value) => value + 1) };

  const onSky = Object.values(boxes).map(({ x, y, width, height }) => ({
    x: x - origin.x,
    y: y - origin.y,
    width,
    height,
  }));
  // A view that draws the sun and moon itself claims them from the sky.
  const { claim, claimed, claimedAtOnce } = useSkyBodyClaims();
  const { bodyOpacity, drawn } = useBodyOpacity({
    ...sky,
    ...size,
    boxes: onSky,
    claimed,
    claimedAtOnce,
  });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
    void measureInWindow(canvas.current).then((box) => box && setOrigin(box));
  };

  return (
    <Background onLayout={onLayout}>
      <SkyPaint
        ref={canvas}
        scene={scene}
        // Without the bodies, the glow rests in its corner.
        celestial={drawn ? celestial : undefined}
        hijriDay={hijriDay}
        isRTL={isRTL}
        reduced={reduced || paused}
        {...size}
        bodies={drawn}
        bodyOpacity={bodyOpacity}
      />
      <LiveSkyContext value={sky}>
        <SkyBodiesContext value={claim}>
          <SkyOccluderContext value={registry}>{children}</SkyOccluderContext>
        </SkyBodiesContext>
      </LiveSkyContext>
    </Background>
  );
};

/** A route's sky: held still while out of focus or hidden by an overlay. */
export const ScreenSky = (props: Omit<Props, "paused">) => {
  const live = useScreenLive();
  return <SkyBackground {...props} paused={!live} />;
};
