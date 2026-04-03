import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Components
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Search, Plus } from "lucide-react-native";

type Props = {
  onOpenSearch: () => void;
};

const MyAthkarEmpty: FC<Props> = ({ onOpenSearch }) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <VStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$12" gap="$4">
      <Icon as={Search} size="xl" color="$typographySecondary" />
      <VStack alignItems="center" gap="$1">
        <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
          {t("athkar.myAthkar.empty.title")}
        </Text>
        <Text size="md" color="$typographySecondary" textAlign="center">
          {t("athkar.myAthkar.empty.subtitle")}
        </Text>
      </VStack>
      <HStack gap="$3">
        <Button
          size="lg"
          action="primary"
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel={t("athkar.myAthkar.add")}>
          <ButtonIcon as={Search} />
          <Button.Text>{t("athkar.myAthkar.add")}</Button.Text>
        </Button>
        <Button
          size="lg"
          variant="outline"
          action="primary"
          onPress={() => router.push("/custom-athkar/new")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.customAthkar.createButton")}>
          <ButtonIcon as={Plus} />
          <Button.Text>{t("athkar.customAthkar.create")}</Button.Text>
        </Button>
      </HStack>
    </VStack>
  );
};

export default MyAthkarEmpty;
