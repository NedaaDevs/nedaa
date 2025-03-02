import React, { use } from "react";

import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Center } from "@/components/ui/center";

const MainScreen = () => {
  const { t } = useTranslation();
  return (
    <>
      <Box
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}>
        <Center>
          <Text>{t("nedaa")}</Text>
        </Center>
      </Box>
    </>
  );
};

export default MainScreen;
