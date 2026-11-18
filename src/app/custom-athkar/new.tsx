import { useTranslation } from "react-i18next";

import { CustomAthkarEditor } from "@/components/athkar/CustomAthkarEditor";
import { useCustomAthkarStore } from "@/stores/custom-athkar";

const NewCustomAthkar = () => {
  const { t } = useTranslation();
  const createGroup = useCustomAthkarStore((s) => s.createGroup);

  return (
    <CustomAthkarEditor
      title={t("athkar.customAthkar.new")}
      name=""
      athkar={[]}
      note={t("athkar.customAthkar.saveNote")}
      onSave={async (name, athkar) => (await createGroup(name, athkar)) !== null}
    />
  );
};

export default NewCustomAthkar;
