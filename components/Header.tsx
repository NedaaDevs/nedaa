import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";

import { useTranslation } from "react-i18next";

const Header = () => {
  const { t } = useTranslation();
  return (
    <Box className="m-2 p-4 rounded-lg bg-background">
      <VStack className="items-start space-y-3">
        <Text className="text-right text-white text-base dark:text-secondary">{t("date")}</Text>
        <HStack className="justify-start w-full space-x-2">
          <Text className="text-4xl font-bold text-tertiary dark:text-typography">
            {t("prayerTime")}{" "}
          </Text>
          <Text className="text-4xl font-bold text-tertiary dark:text-typography">
            {t("prayerName")}
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
};

export default Header;
