import { useTranslation } from "react-i18next";
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import AthkarTabs from "@/components/athkar/AthkarTabs";

const Athkar = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader title={t("athkar.title")} />
      <AthkarTabs />
    </Background>
  );
};

export default Athkar;
