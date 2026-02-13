import { useState, useRef, useEffect } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";
import { router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Components
import TopBar from "@/components/TopBar";
import { SwipeableEntry } from "@/components/Qada/SwipeableEntry";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Pressable } from "@/components/ui/pressable";
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

// Stores
import { useQadaStore } from "@/stores/qada";

// Icons
import { Plus, Check, X, CalendarDays, Settings } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { formatNumberToLocale } from "@/utils/number";

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
  } = useQadaStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState(1);
  const [notes, setNotes] = useState("");

  // Stepper long press state
  const incrementTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const decrementTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticLight = useHaptic("light");

  const remaining = getRemaining();
  const completionPercentage = getCompletionPercentage();

  const incrementAmount = () => {
    setAmount((prev) => Math.min(prev + 1, 999));
  };

  const decrementAmount = () => {
    setAmount((prev) => Math.max(prev - 1, 1));
  };

  const stopIncrement = () => {
    if (incrementTimer.current) {
      clearInterval(incrementTimer.current);
      incrementTimer.current = null;
    }
  };

  const stopDecrement = () => {
    if (decrementTimer.current) {
      clearInterval(decrementTimer.current);
      decrementTimer.current = null;
    }
  };

  const startIncrement = () => {
    hapticLight();
    incrementAmount();

    let count = 0;
    const runIncrement = () => {
      count++;
      incrementAmount();

      // Speed up after 5 increments by clearing and creating new interval
      if (count === 5) {
        if (incrementTimer.current) clearInterval(incrementTimer.current);
        incrementTimer.current = window.setInterval(runIncrement, 100);
      }
    };

    // Start with slower interval (200ms)
    incrementTimer.current = window.setInterval(runIncrement, 200);
  };

  const startDecrement = () => {
    hapticLight();
    decrementAmount();

    let count = 0;
    const runDecrement = () => {
      count++;
      decrementAmount();

      // Speed up after 5 decrements by clearing and creating new interval
      if (count === 5) {
        if (decrementTimer.current) clearInterval(decrementTimer.current);
        decrementTimer.current = window.setInterval(runDecrement, 100);
      }
    };

    // Start with slower interval (200ms)
    decrementTimer.current = window.setInterval(runDecrement, 200);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      stopIncrement();
      stopDecrement();
    };
  }, []);

  const handleQuickAdd = async (days: number) => {
    await hapticSelection();
    await addMissed(days, notes || undefined);
    setShowAddModal(false);
    setNotes("");
    await hapticSuccess();
  };

  const handleAddMissed = async () => {
    if (amount <= 0) return;
    // Stop any running timers before adding
    stopIncrement();
    stopDecrement();
    await addMissed(amount, notes || undefined);
    setAmount(1);
    setNotes("");
    setShowAddModal(false);
    await hapticSuccess();
  };

  const handleModalClose = () => {
    stopIncrement();
    stopDecrement();
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
      <Box position="relative">
        <TopBar title="qada.title" />
        {/* Settings Icon Overlay */}
        <Pressable
          onPress={() => {
            hapticLight();
            router.push("/settings/qada");
          }}
          accessibilityLabel={t("common.settings")}
          position="absolute"
          end={24}
          top={8}
          justifyContent="center"
          minWidth={44}
          minHeight={44}
          alignItems="center"
          padding="$2"
          borderRadius="$4"
          zIndex={50}>
          <Icon as={Settings} size="lg" color="$typographyContrast" />
        </Pressable>
      </Box>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: totalMissed > 0 || totalCompleted > 0 ? 160 : 100,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Progress Dashboard */}
        <VStack paddingHorizontal="$4" paddingTop="$6" paddingBottom="$4" gap="$5">
          {/* Progress Card */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$6">
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
                    backgroundColor="$backgroundMuted">
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
                  <Text size="2xl" fontWeight="600" color="$typography" textAlign="left">
                    {formatNumberToLocale(totalMissed.toString())}
                  </Text>
                  <Text size="xs" color="$typographySecondary" textAlign="left">
                    {t("qada.total")}
                  </Text>
                </VStack>
                <VStack gap="$1" alignItems="center">
                  <Text size="2xl" fontWeight="600" color="$success" textAlign="left">
                    {formatNumberToLocale(totalCompleted.toString())}
                  </Text>
                  <Text size="xs" color="$typographySecondary" textAlign="left">
                    {t("qada.completed")}
                  </Text>
                </VStack>
              </HStack>

              {/* Motivational Message */}
              {remaining === 0 && totalMissed > 0 && (
                <Text textAlign="left" color="$success" fontWeight="500">
                  {t("qada.allComplete")}
                </Text>
              )}
              {remaining > 0 && (
                <Text textAlign="left" color="$typographySecondary">
                  {formatNumberToLocale(t("qada.keepGoing", { count: remaining }))}
                </Text>
              )}
            </VStack>
          </Box>

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
              <Text size="lg" fontWeight="600" color="$typography" textAlign="left">
                {t("qada.pendingEntries")}
              </Text>

              <VStack gap="$2">
                {pendingEntries.map((entry) => (
                  <SwipeableEntry
                    key={entry.id}
                    entry={entry}
                    onComplete={handleCompleteEntry}
                    onCompleteAll={handleCompleteAll}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </VStack>

              <Box
                backgroundColor="$backgroundSecondary"
                opacity={0.8}
                borderRadius="$4"
                padding="$3">
                <Text size="xs" color="$typographySecondary" textAlign="center">
                  {t("qada.swipeHintFull")}
                </Text>
              </Box>
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
                backgroundColor="$backgroundSecondary"
                borderRadius={999}
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
              <Text size="xl" bold color="$typography" textAlign="left">
                {t("qada.addMissedDays")}
              </Text>
            </ModalHeader>

            <ModalBody>
              <ScrollView showsVerticalScrollIndicator={false}>
                <VStack gap="$5">
                  {/* Quick Add: One-tap shortcuts for common values (1, 3, 7, 30 days) */}
                  <VStack gap="$2">
                    <Text size="sm" color="$typographySecondary" textAlign="left">
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
                    <Text size="sm" color="$typographySecondary" textAlign="left">
                      {t("qada.customAmount")}
                    </Text>
                    <HStack gap="$3" alignItems="center" justifyContent="center">
                      <Pressable
                        onPressIn={startDecrement}
                        onPressOut={stopDecrement}
                        onTouchEnd={stopDecrement}
                        disabled={isLoading}
                        width={56}
                        height={56}
                        backgroundColor="$background"
                        borderWidth={2}
                        borderColor="$outline"
                        borderRadius={999}
                        alignItems="center"
                        justifyContent="center">
                        <Text size="2xl" color="$typography" bold>
                          −
                        </Text>
                      </Pressable>

                      <Box flex={1} alignItems="center">
                        <Text size="5xl" bold color="$primary">
                          {formatNumberToLocale(amount.toString())}
                        </Text>
                        <Text size="sm" color="$typographySecondary" marginTop="$1">
                          {formatNumberToLocale(t("qada.days", { count: amount }))}
                        </Text>
                      </Box>

                      <Pressable
                        onPressIn={startIncrement}
                        onPressOut={stopIncrement}
                        onTouchEnd={stopIncrement}
                        disabled={isLoading}
                        width={56}
                        height={56}
                        backgroundColor="$primary"
                        borderRadius={999}
                        alignItems="center"
                        justifyContent="center">
                        <Text size="2xl" color="$typographyContrast" bold>
                          +
                        </Text>
                      </Pressable>
                    </HStack>
                  </VStack>

                  {/* Optional Notes Input */}
                  <VStack gap="$2">
                    <Text size="sm" color="$typographySecondary" textAlign="left">
                      {t("qada.notes")} ({t("common.optional")})
                    </Text>
                    <TextInput
                      placeholder={t("qada.notesPlaceholder")}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      maxLength={200}
                      textAlignVertical="top"
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 14,
                        borderWidth: 1,
                        borderColor: theme.outline?.val,
                        color: theme.typography?.val,
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
