import { FC, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

import { ChevronRight, ChevronLeft, Pencil } from "lucide-react-native";

import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useHaptic } from "@/hooks/useHaptic";
import CustomAthkarCard from "@/components/athkar/CustomAthkarCard";

import type { CustomAthkarGroup } from "@/types/athkar";

type Props = {
  group: CustomAthkarGroup;
  onBack: () => void;
};

const CustomAthkarDetail: FC<Props> = ({ group, onBack }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const getGroupItems = useCustomAthkarStore((s) => s.getGroupItems);
  const getGroupProgress = useCustomAthkarStore((s) => s.getGroupProgress);
  const deleteGroup = useCustomAthkarStore((s) => s.deleteGroup);
  const hapticWarning = useHaptic("warning");

  const isRTL = i18n.dir() === "rtl";
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const items = getGroupItems(group.id);
  const progressList = getGroupProgress(group.id);

  const handleLongPress = useCallback(() => {
    hapticWarning();
    Alert.alert(
      t("athkar.customAthkar.deleteConfirm"),
      t("athkar.customAthkar.deleteWarning"),
      [
        { text: t("athkar.customAthkar.cancel"), style: "cancel" },
        {
          text: t("athkar.customAthkar.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteGroup(group.id);
            onBack();
          },
        },
      ]
    );
  }, [deleteGroup, group.id, onBack, hapticWarning, t]);

  return (
    <>
      {/* Header */}
      <VStack gap="$3" marginBottom="$3">
        <HStack justifyContent="space-between" alignItems="center">
          <Pressable
            onPress={onBack}
            minHeight={44}
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("athkar.myAthkar")}>
            <HStack gap="$1" alignItems="center">
              <Icon as={BackIcon} size="sm" color="$primary" />
              <Text size="sm" color="$primary" fontWeight="600">
                {t("athkar.myAthkar")}
              </Text>
            </HStack>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/custom-athkar/${group.id}`)}
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.customAthkar.editGroup")}>
            <Icon as={Pencil} size="sm" color="$typographySecondary" />
          </Pressable>
        </HStack>

        <Text size="xl" fontWeight="700" color="$typography" textAlign="left">
          {group.title}
        </Text>
      </VStack>

      {/* Thikir Cards */}
      <VStack gap="$3">
        {items.map((item) => {
          const prog = progressList.find((p) => p.customItemId === item.id);
          if (!prog) return null;
          return (
            <CustomAthkarCard
              key={item.id}
              customItemId={item.id}
              arabicText={item.arabicText}
              progress={prog}
              onLongPress={handleLongPress}
            />
          );
        })}
      </VStack>
    </>
  );
};

export default CustomAthkarDetail;
