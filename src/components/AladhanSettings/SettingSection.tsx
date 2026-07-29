import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Select } from "@/components/ui/select";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

// Types
import type { AladhanSection } from "@/components/AladhanSettings/sections";

type Props = {
  section: AladhanSection;
  onChange: (value: string) => void;
};

export const SettingSection: FC<Props> = ({ section, onChange }) => {
  const { t } = useTranslation();

  return (
    <Box marginTop="$6">
      <Text fontSize="$5" fontWeight="600" marginBottom="$4" color="$typography">
        {t(section.titleKey)}
      </Text>

      <Select
        selectedValue={section.value}
        onValueChange={onChange}
        items={section.items}
        placeholder={t(section.placeholderKey)}
      />
    </Box>
  );
};

export default SettingSection;
