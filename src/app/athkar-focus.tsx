import { useLocalSearchParams } from "expo-router";

import { AthkarFocusScreen } from "@/components/athkar/session/AthkarFocusScreen";
import { useAthkarFocusScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";
import { ScreenSky } from "@/components/ui/sky-background";
import { parseSessionSource } from "@/utils/athkarSessionSource";

const AthkarFocusRoute = () => {
  useAthkarFocusScreenshotSeed();
  const source = parseSessionSource(useLocalSearchParams());
  return (
    <ScreenSky>
      <AthkarFocusScreen source={source} />
    </ScreenSky>
  );
};

export default AthkarFocusRoute;
