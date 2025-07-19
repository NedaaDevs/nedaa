import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import AthkarTabs from "@/components/athkar/AthkarTabs";

const Athkar = () => {
  return (
    <Background>
      <TopBar title="athkar.title" />
      <AthkarTabs />
    </Background>
  );
};

export default Athkar;
