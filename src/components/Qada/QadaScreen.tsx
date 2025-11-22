import { useState, useRef } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Components
import TopBar from "@/components/TopBar";
import { SwipeableEntry } from "@/components/Qada/SwipeableEntry";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
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

const QadaScreen = () => {
  const { t } = useTranslation();
  const {
    totalMissed,
    totalCompleted,
    totalOriginal,
    pendingEntries,
    isLoading,
    addMissed,
    completeEntry,
    completeAllEntries,
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

  const incrementAmount = () => {
    setAmount((prev) => Math.min(prev + 1, 999));
  };

  const decrementAmount = () => {
    setAmount((prev) => Math.max(prev - 1, 1));
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

  const stopIncrement = () => {
    if (incrementTimer.current) {
      clearInterval(incrementTimer.current);
      incrementTimer.current = null;
    }
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

  const stopDecrement = () => {
    if (decrementTimer.current) {
      clearInterval(decrementTimer.current);
      decrementTimer.current = null;
    }
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

  const handleCompleteAll = async () => {
    await hapticSuccess();
    await completeAllEntries();
  };

  const handleDeleteEntry = async (id: number) => {
    await hapticSuccess();
    await deleteEntry(id);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: totalMissed > 0 || totalCompleted > 0 ? 160 : 100,
        }}
        showsVerticalScrollIndicator={false}>
        <Box className="relative">
          <TopBar title="qada.title" />
          {/* Settings Icon Overlay */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/settings/qada");
            }}
            className="absolute right-6 top-2 justify-center p-2 rounded-lg"
            style={{ zIndex: 50, elevation: 4 }}>
            <Icon as={Settings} size="lg" className="text-typography-contrast" />
          </Pressable>
        </Box>

        {/* Progress Dashboard */}
        <VStack className="px-4 py-6" space="xl">
          {/* Progress Card */}
          <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
            <VStack space="lg" className="items-center">
              {/* Main Stats */}
              <VStack space="sm" className="items-center w-full">
                <Text
                  className="text-4xl font-bold text-typography text-center w-full"
                  numberOfLines={1}
                  ellipsizeMode="clip">
                  {remaining}
                </Text>
                <Text className="text-lg text-typography-secondary text-center">
                  {t("qada.daysRemaining", { count: remaining })}
                </Text>
              </VStack>

              {/* Progress Bar */}
              {totalMissed > 0 && (
                <VStack space="sm" className="w-full">
                  <Progress value={completionPercentage} className="h-3 bg-background-tertiary">
                    <ProgressFilledTrack className="bg-accent-primary" />
                  </Progress>
                  <Text className="text-sm text-center text-typography-secondary">
                    {t("qada.completionPercentage", { percentage: completionPercentage })} •{" "}
                    {t("qada.progressContext", {
                      completed: totalCompleted,
                      total: totalOriginal,
                    })}
                  </Text>
                </VStack>
              )}

              {/* Stats Row */}
              <HStack space="xl" className="w-full justify-around pt-4">
                <VStack space="xs" className="items-center">
                  <Text className="text-2xl font-semibold text-typography text-left">
                    {totalMissed}
                  </Text>
                  <Text className="text-xs text-typography-secondary text-left">
                    {t("qada.total")}
                  </Text>
                </VStack>
                <VStack space="xs" className="items-center">
                  <Text className="text-2xl font-semibold text-success text-left">
                    {totalCompleted}
                  </Text>
                  <Text className="text-xs text-typography-secondary text-left">
                    {t("qada.completed")}
                  </Text>
                </VStack>
              </HStack>

              {/* Motivational Message */}
              {remaining === 0 && totalMissed > 0 && (
                <Text className="text-left text-success font-medium">{t("qada.allComplete")}</Text>
              )}
              {remaining > 0 && (
                <Text className="text-left text-typography-secondary">
                  {t("qada.keepGoing", { count: remaining })}
                </Text>
              )}
            </VStack>
          </Box>

          {/* Add Button */}
          <Button
            onPress={() => {
              setShowAddModal(true);
            }}
            className="bg-accent-primary"
            size="lg"
            isDisabled={isLoading}>
            <HStack space="sm" className="items-center">
              <Icon as={Plus} className="text-background" />
              <ButtonText className="text-background">{t("qada.addMissedDays")}</ButtonText>
            </HStack>
          </Button>

          {/* Pending Entries List */}
          {pendingEntries.length > 0 && (
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography text-left">
                {t("qada.pendingEntries")}
              </Text>

              <VStack space="sm">
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

              <Box className="bg-background-tertiary/50 rounded-lg p-3">
                <Text className="text-xs text-typography-secondary text-center">
                  💡 {t("qada.swipeHintFull")}
                </Text>
              </Box>
            </VStack>
          )}

          {/* Empty State */}
          {pendingEntries.length === 0 && remaining === 0 && totalMissed > 0 && (
            <Box className="py-8 items-center">
              <Box className="w-20 h-20 items-center justify-center">
                <Icon as={Check} className="text-success" size="xl" />
              </Box>
              <Text className="text-lg font-semibold text-success mt-4">
                {t("qada.allComplete")}
              </Text>
              <Text className="text-sm text-typography-secondary text-center mt-2">
                {t("qada.allCompleteMessage")}
              </Text>
            </Box>
          )}

          {pendingEntries.length === 0 && totalMissed === 0 && (
            <Box className="py-8 items-center">
              <Box className="w-20 h-20 items-center justify-center">
                <Icon as={CalendarDays} className="text-typography-secondary" size="xl" />
              </Box>
              <Text className="text-base text-typography-secondary text-center mt-4">
                {t("qada.noEntriesYet")}
              </Text>
            </Box>
          )}
        </VStack>

        {/* Add Missed Days Modal: Quick add buttons + stepper control for intuitive UX */}
        <Modal isOpen={showAddModal} onClose={handleModalClose} size="md">
          <ModalBackdrop />
          <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl">
            <ModalCloseButton className="absolute top-4 right-4 z-10">
              <Icon as={X} className="text-typography-secondary" size="lg" />
            </ModalCloseButton>

            <ModalHeader className="px-6 pt-6 pb-4">
              <Text className="text-xl font-bold text-typography text-left">
                {t("qada.addMissedDays")}
              </Text>
            </ModalHeader>

            <ModalBody className="px-6 py-2">
              <ScrollView showsVerticalScrollIndicator={false}>
                <VStack space="xl">
                  {/* Quick Add: One-tap shortcuts for common values (1, 3, 7, 30 days) */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
                      {t("qada.quickAdd")}
                    </Text>
                    <HStack space="xs" className="w-full">
                      {[1, 3, 7, 30].map((days) => (
                        <Button
                          key={days}
                          onPress={() => handleQuickAdd(days)}
                          variant="outline"
                          isDisabled={isLoading}
                          className="flex-1 border-accent-primary px-2">
                          <ButtonText className="text-accent-primary font-semibold text-center">
                            +{days}
                          </ButtonText>
                        </Button>
                      ))}
                    </HStack>
                  </VStack>

                  {/* Divider with "or" text */}
                  <HStack space="sm" className="items-center">
                    <Box className="flex-1 h-px bg-outline" />
                    <Text className="text-xs text-typography-secondary">{t("common.or")}</Text>
                    <Box className="flex-1 h-px bg-outline" />
                  </HStack>

                  {/* Stepper Control: Fine-tune any amount with -/+ buttons */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
                      {t("qada.customAmount")}
                    </Text>
                    <HStack space="md" className="items-center justify-center">
                      <Pressable
                        onPressIn={startDecrement}
                        onPressOut={stopDecrement}
                        disabled={isLoading}
                        className="w-14 h-14 bg-background border-2 border-outline rounded-full items-center justify-center active:bg-background-tertiary">
                        <Text className="text-2xl text-typography font-bold">−</Text>
                      </Pressable>

                      <Box className="flex-1 items-center">
                        <Text className="text-5xl font-bold text-accent-primary">{amount}</Text>
                        <Text className="text-sm text-typography-secondary mt-1">
                          {t("qada.days", { count: amount })}
                        </Text>
                      </Box>

                      <Pressable
                        onPressIn={startIncrement}
                        onPressOut={stopIncrement}
                        disabled={isLoading}
                        className="w-14 h-14 bg-accent-primary rounded-full items-center justify-center active:opacity-80">
                        <Text className="text-2xl text-background font-bold">+</Text>
                      </Pressable>
                    </HStack>
                  </VStack>

                  {/* Optional Notes Input */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
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
                      className="p-3 bg-background-secondary rounded-lg text-sm text-typography border border-outline min-h-[80px]"
                      placeholderTextColor="#9CA3AF"
                    />
                  </VStack>
                </VStack>
              </ScrollView>
            </ModalBody>

            <ModalFooter className="px-6 py-6">
              <Button
                onPress={handleAddMissed}
                isDisabled={isLoading || amount <= 0}
                className="w-full bg-accent-primary"
                size="lg">
                <ButtonText className="text-background text-base font-semibold">
                  {t("qada.addDays", { count: amount, defaultValue: `Add ${amount} Days` })}
                </ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </ScrollView>
    </GestureHandlerRootView>
  );
};

export default QadaScreen;
