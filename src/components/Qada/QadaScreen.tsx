import { useState, useEffect } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";
import { router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Components
import { ScreenHeader } from "@/components/ui/screen-header";
import { SwipeableEntry } from "@/components/Qada/SwipeableEntry";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Stepper } from "@/components/ui/stepper";
import { Icon } from "@/components/ui/icon";

import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";

// Constants
import { BACK_DESTINATION } from "@/constants/BackDestinations";

// Stores
import { useQadaStore } from "@/stores/qada";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Icons
import { Plus, Check, X, CalendarDays, Settings } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

// Utils
import { formatNumberToLocale } from "@/utils/number";

/** The custom amount the add sheet accepts, in days. */
const MIN_CUSTOM_DAYS = 1;
const MAX_CUSTOM_DAYS = 999;

const QadaScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    totalMissed,
    totalCompleted,
    totalOriginal,
    pendingEntries,
    isLoading,
    addMissed,
    completeEntry,
    completeSpecificEntry,
    deleteEntry,
    getRemaining,
    getCompletionPercentage,
    seedScreenshotState,
  } = useQadaStore();

  const screenshotSeed = useScreenshotSeed("qada");

  // In screenshot mode the qada SQLite store is empty, so the screen would
  // render zeros and the "no entries yet" empty state. Derive a believable
  // populated dashboard from the active preset. Runs after app setup's
  // loadData() (which clears state from the empty DB), keeping production
  // behavior untouched when no seed is active.
  useEffect(() => {
    if (!screenshotSeed) return;
    seedScreenshotState(screenshotSeed);
  }, [screenshotSeed, seedScreenshotState]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState(1);
  const [notes, setNotes] = useState("");

  const { isRTL } = useRTL();
  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticLight = useHaptic("light");

  const remaining = getRemaining();
  const completionPercentage = getCompletionPercentage();

  const handleQuickAdd = async (days: number) => {
    await hapticSelection();
    await addMissed(days, notes || undefined);
    setShowAddModal(false);
    setNotes("");
    await hapticSuccess();
  };

  const handleAddMissed = async () => {
    if (amount <= 0) return;
    await addMissed(amount, notes || undefined);
    setAmount(1);
    setNotes("");
    setShowAddModal(false);
    await hapticSuccess();
  };

  const handleModalClose = () => {
    setNotes("");
    setShowAddModal(false);
  };

  const handleCompleteEntry = async (id: number) => {
    await hapticSelection();
    await completeEntry(id);
    if (remaining - 1 === 0) {
      await hapticSuccess();
    }
  };

  const handleCompleteAll = async (id: number) => {
    await hapticSuccess();
    await completeSpecificEntry(id);
  };

  const handleDeleteEntry = async (id: number) => {
    await hapticSuccess();
    await deleteEntry(id);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenHeader
        variant="bar"
        title={t("qada.title")}
        back={{ to: BACK_DESTINATION.TOOLS }}
        action={{
          icon: Settings,
          label: t("common.settings"),
          onPress: () => {
            hapticLight();
            router.push("/settings/qada");
          },
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: totalMissed > 0 || totalCompleted > 0 ? 160 : 100,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Progress Dashboard */}
        <VStack paddingHorizontal="$4" paddingTop="$6" paddingBottom="$4" gap="$5">
          {/* Progress Card */}
          <Card padding="$6">
            <VStack gap="$4" alignItems="center">
              {/* Main Stats */}
              <VStack gap="$2" alignItems="center" width="100%">
                <Text
                  size="4xl"
                  bold
                  color="$typography"
                  textAlign="center"
                  width="100%"
                  numberOfLines={1}>
                  {formatNumberToLocale(remaining.toString())}
                </Text>
                <Text size="lg" color="$typographySecondary" textAlign="center">
                  {formatNumberToLocale(t("qada.daysRemaining", { count: remaining }))}
                </Text>
              </VStack>

              {/* Progress Bar */}
              {totalMissed > 0 && (
                <VStack gap="$2" width="100%">
                  <Progress
                    value={completionPercentage}
                    size="md"
                    backgroundColor="$backgroundMuted"
                    accessibilityLabel={t("a11y.qada.progress")}
                    accessibilityValue={{ min: 0, max: 100, now: completionPercentage }}>
                    <ProgressFilledTrack backgroundColor="$primary" />
                  </Progress>
                  <Text size="sm" textAlign="center" color="$typographySecondary">
                    {formatNumberToLocale(
                      t("qada.completionPercentage", { percentage: completionPercentage })
                    )}{" "}
                    •{" "}
                    {formatNumberToLocale(
                      t("qada.progressContext", {
                        completed: totalCompleted,
                        total: totalOriginal,
                      })
                    )}
                  </Text>
                </VStack>
              )}

              {/* Stats Row */}
              <HStack gap="$5" width="100%" justifyContent="space-around" paddingTop="$4">
                <VStack gap="$1" alignItems="center">
                  <Text size="2xl" fontWeight="600" color="$typography">
                    {formatNumberToLocale(totalMissed.toString())}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("qada.total")}
                  </Text>
                </VStack>
                <VStack gap="$1" alignItems="center">
                  <Text size="2xl" fontWeight="600" color="$success">
                    {formatNumberToLocale(totalCompleted.toString())}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("qada.completed")}
                  </Text>
                </VStack>
              </HStack>

              {/* Motivational Message */}
              {remaining === 0 && totalMissed > 0 && (
                <Text color="$success" fontWeight="500">
                  {t("qada.allComplete")}
                </Text>
              )}
              {remaining > 0 && (
                <Text color="$typographySecondary">
                  {formatNumberToLocale(t("qada.keepGoing", { count: remaining }))}
                </Text>
              )}
            </VStack>
          </Card>

          {/* Add Button */}
          <Button
            onPress={() => {
              setShowAddModal(true);
            }}
            size="lg"
            disabled={isLoading}>
            <HStack gap="$2" alignItems="center">
              <Icon as={Plus} color="$typographyContrast" />
              <Button.Text>{t("qada.addMissedDays")}</Button.Text>
            </HStack>
          </Button>

          {/* Pending Entries List */}
          {pendingEntries.length > 0 && (
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                {t("qada.pendingEntries")}
              </Text>

              <VStack gap="$2">
                {pendingEntries.map((entry) => (
                  <SwipeableEntry
                    key={`${entry.id}-${isRTL}`}
                    entry={entry}
                    onComplete={handleCompleteEntry}
                    onCompleteAll={handleCompleteAll}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </VStack>

              <Card opacity={0.8} padding="$3">
                <Text size="xs" color="$typographySecondary" textAlign="center">
                  {t("qada.swipeHintFull")}
                </Text>
              </Card>
            </VStack>
          )}

          {/* Empty State */}
          {pendingEntries.length === 0 && remaining === 0 && totalMissed > 0 && (
            <VStack paddingVertical="$8" alignItems="center" gap="$3">
              <Box
                width={80}
                height={80}
                backgroundColor="$backgroundSuccess"
                borderRadius={999}
                alignItems="center"
                justifyContent="center">
                <Icon as={Check} color="$success" size="xl" />
              </Box>
              <VStack alignItems="center" gap="$1">
                <Text size="lg" fontWeight="600" color="$success">
                  {t("qada.allComplete")}
                </Text>
                <Text
                  size="sm"
                  color="$typographySecondary"
                  textAlign="center"
                  paddingHorizontal="$4">
                  {t("qada.allCompleteMessage")}
                </Text>
              </VStack>
            </VStack>
          )}

          {pendingEntries.length === 0 && totalMissed === 0 && (
            <VStack paddingVertical="$8" alignItems="center" gap="$3">
              <Box
                width={80}
                height={80}
                borderRadius={999}
                // eslint-disable-next-line no-restricted-syntax -- circular icon well, not a card surface
                backgroundColor="$backgroundSecondary"
                alignItems="center"
                justifyContent="center">
                <Icon as={CalendarDays} color="$typographySecondary" size="xl" />
              </Box>
              <Text
                size="md"
                color="$typographySecondary"
                textAlign="center"
                paddingHorizontal="$4">
                {t("qada.noEntriesYet")}
              </Text>
            </VStack>
          )}
        </VStack>

        {/* Add Missed Days Modal: Quick add buttons + stepper control for intuitive UX */}
        <Modal isOpen={showAddModal} onClose={handleModalClose} size="md">
          <ModalBackdrop />
          <ModalContent>
            <ModalCloseButton>
              <Icon as={X} color="$typographySecondary" size="lg" />
            </ModalCloseButton>

            <ModalHeader>
              <Text size="xl" bold color="$typography">
                {t("qada.addMissedDays")}
              </Text>
            </ModalHeader>

            <ModalBody>
              <ScrollView showsVerticalScrollIndicator={false}>
                <VStack gap="$5">
                  {/* Quick Add: One-tap shortcuts for common values (1, 3, 7, 30 days) */}
                  <VStack gap="$2">
                    <Text size="sm" color="$typographySecondary">
                      {t("qada.quickAdd")}
                    </Text>
                    <HStack gap="$1" width="100%">
                      {[1, 3, 7, 30].map((days) => (
                        <Button
                          key={days}
                          onPress={() => handleQuickAdd(days)}
                          variant="outline"
                          disabled={isLoading}
                          flex={1}
                          paddingHorizontal="$2"
                          borderColor="$primary">
                          <Button.Text color="$primary" fontWeight="600" textAlign="center">
                            +{formatNumberToLocale(days.toString())}
                          </Button.Text>
                        </Button>
                      ))}
                    </HStack>
                  </VStack>

                  {/* Divider with "or" text */}
                  <HStack gap="$2" alignItems="center">
                    <Box flex={1} height={1} backgroundColor="$outline" />
                    <Text size="xs" color="$typographySecondary">
                      {t("common.or")}
                    </Text>
                    <Box flex={1} height={1} backgroundColor="$outline" />
                  </HStack>

                  {/* Stepper Control: Fine-tune any amount with -/+ buttons */}
                  <VStack gap="$2">
                    <Text size="sm" color="$typographySecondary">
                      {t("qada.customAmount")}
                    </Text>
                    <Stepper
                      value={amount}
                      onChange={setAmount}
                      min={MIN_CUSTOM_DAYS}
                      max={MAX_CUSTOM_DAYS}
                      accessibilityLabel={t("qada.customAmount")}
                      valueText={formatNumberToLocale(t("qada.days", { count: amount }))}
                      disabled={isLoading}>
                      <Text size="5xl" bold color="$primary">
                        {formatNumberToLocale(amount.toString())}
                      </Text>
                      <Text size="sm" color="$typographySecondary" marginTop="$1">
                        {formatNumberToLocale(t("qada.days", { count: amount }))}
                      </Text>
                    </Stepper>
                  </VStack>

                  {/* Optional Notes Input */}
                  <VStack gap="$2">
                    <Text size="sm" color="$typographySecondary">
                      {t("qada.notes")} ({t("common.optional")})
                    </Text>
                    <TextInput
                      accessibilityLabel={t("qada.notes")}
                      placeholder={t("qada.notesPlaceholder")}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      maxLength={200}
                      textAlignVertical="top"
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        fontSize: 14,
                        borderWidth: 1,
                        borderColor: theme.outline?.val,
                        color: theme.typography?.val,
                        backgroundColor: theme.backgroundSecondary?.val,
                        minHeight: 80,
                      }}
                      placeholderTextColor={theme.typographySecondary?.val}
                    />
                  </VStack>
                </VStack>
              </ScrollView>
            </ModalBody>

            <ModalFooter>
              <Button
                onPress={handleAddMissed}
                disabled={isLoading || amount <= 0}
                width="100%"
                size="lg">
                <Button.Text size="md" fontWeight="600">
                  {formatNumberToLocale(
                    t("qada.addDays", { count: amount, defaultValue: `Add ${amount} Days` })
                  )}
                </Button.Text>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </ScrollView>
    </GestureHandlerRootView>
  );
};

export default QadaScreen;
