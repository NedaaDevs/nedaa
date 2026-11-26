import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { CustomAthkarEditor } from "@/components/athkar/CustomAthkarEditor";
import { useCustomAthkarStore } from "@/stores/custom-athkar";

const EditCustomAthkar = () => {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const group = useCustomAthkarStore((s) => s.groups.find((g) => g.id === groupId));
  const getGroupItems = useCustomAthkarStore((s) => s.getGroupItems);
  const updateGroup = useCustomAthkarStore((s) => s.updateGroup);
  const deleteGroup = useCustomAthkarStore((s) => s.deleteGroup);

  if (!group) return null;

  return (
    <CustomAthkarEditor
      title={t("athkar.customAthkar.edit")}
      name={group.title}
      athkar={getGroupItems(groupId)}
      onSave={(name, athkar) => updateGroup(groupId, name, athkar)}
      onDelete={() => deleteGroup(groupId)}
    />
  );
};

export default EditCustomAthkar;
