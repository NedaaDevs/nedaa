import { AthkarFocusScreen } from "@/components/athkar/session/AthkarFocusScreen";
import { useAthkarFocusScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";
import { ScreenSky } from "@/components/ui/sky-background";

const AthkarFocusRoute = () => {
  useAthkarFocusScreenshotSeed();
  return (
    <ScreenSky>
      <AthkarFocusScreen />
    </ScreenSky>
  );
};

export default AthkarFocusRoute;
