import { useEffect, useState } from "react";
import { ScrollView, TextInput, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DateTimePicker from "@react-native-community/datetimepicker";

// Components
import { Background } from "@/components/ui/background";
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
import { Plus, Check, X, CalendarDays, Calendar } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { format } from "date-fns";

// Enums
import { PlatformType } from "@/enums/app";

const QadaScreen = () => {
  const { t } = useTranslation();
  const {
    totalMissed,
    totalCompleted,
    totalOriginal,
    pendingEntries,
    isLoading,
    loadData,
    addMissed,
    completeEntry,
    completeAllEntries,
    deleteEntry,
    getRemaining,
    getCompletionPercentage,
  } = useQadaStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [inputMode, setInputMode] = useState<"simple" | "dateRange">("simple");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const remaining = getRemaining();
  const completionPercentage = getCompletionPercentage();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateDaysBetween = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end dates
  };

  const handleAddMissed = async () => {
    let amount: number;
    let notes: string | undefined;

    if (inputMode === "simple") {
      amount = parseInt(customAmount);
      if (!amount || amount <= 0) return;
    } else {
      // Date range mode - auto-calculate count
      amount = calculateDaysBetween(startDate, endDate);
      notes = `${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`;
    }

    await addMissed(amount, notes);

    // Reset form
    setCustomAmount("");
    setInputMode("simple");
    setStartDate(new Date());
    setEndDate(new Date());
    setShowAddModal(false);
    await hapticSuccess();
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
    await hapticWarning();
    await deleteEntry(id);
  };

  const onStartDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === PlatformType.ANDROID) {
      setShowStartDatePicker(false);
    }
    if (date) {
      setStartDate(date);
      // Auto-adjust end date if it's before start date
      if (endDate < date) {
        setEndDate(date);
      }
    }
  };

  const onEndDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === PlatformType.ANDROID) {
      setShowEndDatePicker(false);
    }
    if (date) {
      setEndDate(date);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Background>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}>
          <TopBar title="qada.title" />

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
                    <Text className="text-sm text-left text-typography-secondary">
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
                  <Text className="text-left text-success font-medium">
                    {t("qada.allComplete")}
                  </Text>
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
              onPress={() => setShowAddModal(true)}
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

          {/* Add Modal */}
          <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="md">
            <ModalBackdrop />
            <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl">
              <ModalCloseButton className="absolute top-4 right-4 z-10">
                <Icon as={X} className="text-typography-secondary" size="lg" />
              </ModalCloseButton>

              <ModalHeader className="px-6 pt-6 pb-2">
                <Text className="text-xl font-bold text-typography text-left">
                  {t("qada.addMissedDays")}
                </Text>
              </ModalHeader>

              <ModalBody className="px-6 pt-2">
                <VStack space="md">
                  {/* Mode Selection */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
                      {t("qada.inputModeLabel")}
                    </Text>
                    <VStack space="xs">
                      {/* Simple Mode */}
                      <Pressable
                        onPress={() => setInputMode("simple")}
                        className="flex-row items-center py-2">
                        <Box
                          className={`w-5 h-5 rounded-full border-2 ${
                            inputMode === "simple" ? "border-accent-primary" : "border-outline"
                          } items-center justify-center mr-3`}>
                          {inputMode === "simple" && (
                            <Box className="w-3 h-3 rounded-full bg-accent-primary" />
                          )}
                        </Box>
                        <Text className="text-sm text-typography text-left">
                          {t("qada.modeSimple")}
                        </Text>
                      </Pressable>

                      {/* Date Range Mode */}
                      <Pressable
                        onPress={() => setInputMode("dateRange")}
                        className="flex-row items-center py-2">
                        <Box
                          className={`w-5 h-5 rounded-full border-2 ${
                            inputMode === "dateRange" ? "border-accent-primary" : "border-outline"
                          } items-center justify-center mr-3`}>
                          {inputMode === "dateRange" && (
                            <Box className="w-3 h-3 rounded-full bg-accent-primary" />
                          )}
                        </Box>
                        <Text className="text-sm text-typography text-left">
                          {t("qada.modeDateRange")}
                        </Text>
                      </Pressable>
                    </VStack>
                  </VStack>

                  {/* Simple Mode Input */}
                  {inputMode === "simple" && (
                    <VStack space="sm">
                      <Text className="text-sm text-typography-secondary text-left">
                        {t("qada.enterNumberOfDays")}
                      </Text>
                      <TextInput
                        placeholder={t("qada.enterAmount")}
                        keyboardType="number-pad"
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        className="bg-background border border-outline rounded-lg px-4 py-3 text-typography text-base"
                        placeholderTextColor="#9CA3AF"
                      />
                    </VStack>
                  )}

                  {/* Date Range Mode Input */}
                  {inputMode === "dateRange" && (
                    <VStack space="md">
                      {/* Start Date */}
                      <VStack space="sm">
                        <Text className="text-xs text-typography-secondary text-left">
                          {t("qada.startDate")}
                        </Text>
                        <Pressable
                          onPress={() => setShowStartDatePicker(true)}
                          className="bg-background border border-outline rounded-lg px-4 py-3 flex-row items-center justify-between">
                          <HStack space="sm" className="items-center">
                            <Icon as={Calendar} className="text-accent-primary" size="sm" />
                            <Text className="text-typography">
                              {format(startDate, "MMMM dd, yyyy")}
                            </Text>
                          </HStack>
                        </Pressable>

                        {showStartDatePicker && (
                          <DateTimePicker
                            value={startDate}
                            mode="date"
                            display={Platform.OS === "ios" ? "spinner" : "default"}
                            onChange={onStartDateChange}
                            maximumDate={new Date()}
                          />
                        )}
                      </VStack>

                      {/* End Date */}
                      <VStack space="sm">
                        <Text className="text-xs text-typography-secondary text-left">
                          {t("qada.endDate")}
                        </Text>
                        <Pressable
                          onPress={() => setShowEndDatePicker(true)}
                          className="bg-background border border-outline rounded-lg px-4 py-3 flex-row items-center justify-between">
                          <HStack space="sm" className="items-center">
                            <Icon as={Calendar} className="text-accent-primary" size="sm" />
                            <Text className="text-typography">
                              {format(endDate, "MMMM dd, yyyy")}
                            </Text>
                          </HStack>
                        </Pressable>

                        {showEndDatePicker && (
                          <DateTimePicker
                            value={endDate}
                            mode="date"
                            display={Platform.OS === "ios" ? "spinner" : "default"}
                            onChange={onEndDateChange}
                            minimumDate={startDate}
                            maximumDate={new Date()}
                          />
                        )}
                      </VStack>

                      {/*  Count Display */}
                      <Box className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-3">
                        <Text className="text-sm text-typography-secondary text-center">
                          {t("qada.totalDays")}:{" "}
                          <Text className="text-lg font-semibold text-accent-primary">
                            {calculateDaysBetween(startDate, endDate)}
                          </Text>
                        </Text>
                      </Box>
                    </VStack>
                  )}
                </VStack>
              </ModalBody>

              <ModalFooter className="px-6 py-6">
                <HStack space="sm" className="w-full">
                  <Button
                    onPress={() => {
                      setShowAddModal(false);
                      setInputMode("simple");
                    }}
                    variant="outline"
                    className="flex-1">
                    <ButtonText>{t("common.cancel")}</ButtonText>
                  </Button>
                  <Button
                    onPress={handleAddMissed}
                    className="flex-1 bg-accent-primary"
                    isDisabled={
                      inputMode === "simple" && (!customAmount || parseInt(customAmount) <= 0)
                    }>
                    <ButtonText className="text-background">{t("qada.add")}</ButtonText>
                  </Button>
                </HStack>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </ScrollView>
      </Background>
    </GestureHandlerRootView>
  );
};

export default QadaScreen;
