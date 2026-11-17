import { AthkarFocusScreen } from "@/components/athkar/session/AthkarFocusScreen";
import { useAthkarFocusScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";

const AthkarFocusRoute = () => {
  useAthkarFocusScreenshotSeed();
  return <AthkarFocusScreen />;
};

export default AthkarFocusRoute;
