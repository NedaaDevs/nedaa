import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import AthkarTabs from "@/components/athkar/AthkarTabs";

const Athkar = () => {
  return (
    <Background>
      <ScreenHeader title="athkar.title" />
      <AthkarTabs />
    </Background>
  );
};

export default Athkar;
