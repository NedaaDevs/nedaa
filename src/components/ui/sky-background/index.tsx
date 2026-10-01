import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { useWindowDimensions, type LayoutChangeEvent, type View } from "react-native";

import { Background } from "@/components/ui/background";
import {
  SkyOccluder,
  SkyOccluderContext,
  SkyScrollView,
} from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SkyPaint } from "@/components/ui/sky-background/SkyPaint";
import { useBodyBehindText } from "@/components/ui/sky-background/useBodyBehindText";
import { LiveSkyContext, useLiveSky } from "@/components/ui/sky-background/useLiveSky";
import { measureInWindow } from "@/utils/measureInWindow";
import type { WindowRect } from "@/utils/sky";

export { SKY_PART, SkyOccluder, SkyScrollView };

type Props = { children?: ReactNode };

/** The screen surface: the sky for the current brightness, phase and hour. */
export const SkyBackground = ({ children }: Props) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const sky = useLiveSky();
  const { scene, celestial, hijriDay, isRTL, reduced } = sky;

  // Text blocks over the sky, in window points, and where the sky itself sits.
  const [boxes, setBoxes] = useState<Record<string, WindowRect>>({});
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [epoch, setEpoch] = useState(0);
  const canvas = useRef<ComponentRef<typeof View>>(null);
  // Stable, and a no-op for an unchanged box, so measuring never loops a render.
  const [report] = useState(
    () => (id: string, box: WindowRect | null) =>
      setBoxes((current) => {
        const { [id]: old, ...rest } = current;
        if (!box) return old ? rest : current;
        const same =
          old && (Object.keys(box) as (keyof WindowRect)[]).every((k) => old[k] === box[k]);
        return same ? current : { ...rest, [id]: box };
      })
  );
  const registry = { report, epoch, remeasure: () => setEpoch((value) => value + 1) };

  const onSky = Object.values(boxes).map(({ x, y, width, height }) => ({
    x: x - origin.x,
    y: y - origin.y,
    width,
    height,
  }));
  const bodyOpacity = useBodyBehindText({ ...sky, ...size, boxes: onSky });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
    void measureInWindow(canvas.current).then((box) => box && setOrigin(box));
  };

  return (
    <Background onLayout={onLayout}>
      <SkyPaint
        ref={canvas}
        scene={scene}
        celestial={celestial}
        hijriDay={hijriDay}
        isRTL={isRTL}
        reduced={reduced}
        {...size}
        bodyOpacity={bodyOpacity}
      />
      <LiveSkyContext value={sky}>
        <SkyOccluderContext value={registry}>{children}</SkyOccluderContext>
      </LiveSkyContext>
    </Background>
  );
};
