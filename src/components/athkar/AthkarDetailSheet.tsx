import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Minus, Plus } from "lucide-react-native";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Types
import type { MyAthkarProgress } from "@/types/hisnMuslim";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  myAthkarId: number | null;
  arabicText: string;
  transliteration: string;
  translation: string;
  categoryTitle: string;
  progress: MyAthkarProgress | null;
};

const AthkarDetailSheet: FC<Props> = ({
  isOpen,
  onClose,
  myAthkarId,
  arabicText,
  transliteration,
  translation,
  categoryTitle,
  progress,
}) => {
  const { t } = useTranslation();
  const { incrementCount, decrementCount } = useMyAthkarStore();
  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");

  if (!myAthkarId || !progress) return null;

  const { currentCount, totalCount, completed } = progress;

  const handleIncrement = () => {
    if (completed) return;
    hapticSelection();
    incrementCount(myAthkarId);
    if (currentCount + 1 >= totalCount) {
      hapticSuccess();
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView>
          <VStack gap="$4" padding="$4">
            {/* Category */}
            <Text size="sm" color="$typographySecondary">
              {categoryTitle}
            </Text>

            {/* Arabic Text */}
            <Box padding="$4" borderRadius="$4" backgroundColor="$backgroundSecondary">
              <Text
                size="2xl"
                style={{ writingDirection: "rtl", lineHeight: 40 }}
                textAlign="right"
                color="$typography">
                {arabicText}
              </Text>
            </Box>

            {/* Transliteration */}
            {transliteration !== "" && (
              <VStack gap="$1">
                <Text size="xs" fontWeight="600" color="$typographySecondary">
                  {t("athkar.myAthkar.transliteration")}
                </Text>
                <Text size="md" color="$typographySecondary" fontStyle="italic">
                  {transliteration}
                </Text>
              </VStack>
            )}

            {/* Translation */}
            {translation !== "" && (
              <VStack gap="$1">
                <Text size="xs" fontWeight="600" color="$typographySecondary">
                  {t("athkar.myAthkar.translation")}
                </Text>
                <Text size="md" color="$typography">
                  {translation}
                </Text>
              </VStack>
            )}

            {/* Counter */}
            <Box
              padding="$4"
              borderRadius="$6"
              backgroundColor={completed ? "$backgroundSuccess" : "$backgroundSecondary"}>
              <HStack justifyContent="center" alignItems="center" gap="$6">
                <Pressable
                  onPress={() => {
                    decrementCount(myAthkarId);
                    hapticSelection();
                  }}
                  disabled={currentCount <= 0}
                  width={56}
                  height={56}
                  borderRadius={999}
                  backgroundColor="$backgroundMuted"
                  alignItems="center"
                  justifyContent="center"
                  opacity={currentCount <= 0 ? 0.3 : 1}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease count">
                  <Icon as={Minus} size="lg" color="$typography" />
                </Pressable>

                <Pressable
                  onPress={handleIncrement}
                  disabled={completed}
                  accessibilityRole="button"
                  accessibilityLabel={`${currentCount} of ${totalCount}`}>
                  <VStack alignItems="center">
                    <Text size="3xl" fontWeight="700" color="$typography">
                      {formatNumberToLocale(`${currentCount}`)}
                    </Text>
                    <Text size="sm" color="$typographySecondary">
                      / {formatNumberToLocale(`${totalCount}`)}
                    </Text>
                  </VStack>
                </Pressable>

                <Pressable
                  onPress={handleIncrement}
                  disabled={completed}
                  width={56}
                  height={56}
                  borderRadius={999}
                  backgroundColor={completed ? "$success" : "$primary"}
                  alignItems="center"
                  justifyContent="center"
                  opacity={completed ? 0.5 : 1}
                  accessibilityRole="button"
                  accessibilityLabel="Increase count">
                  <Icon as={Plus} size="lg" color="$typographyContrast" />
                </Pressable>
              </HStack>
            </Box>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default AthkarDetailSheet;
