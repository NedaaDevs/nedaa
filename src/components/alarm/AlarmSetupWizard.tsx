import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, Platform } from "react-native";

// Components
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import { X, Sun, CalendarDays, Clock } from "lucide-react-native";

// Types
import type { AlarmType, AlarmSettings, AlarmChallengeType, MathDifficulty } from "@/types/alarm";

type TimeOption = {
  id: string;
  offsetMinutes: number;
  label: string;
  isCustom?: boolean;
};

type AlarmSetupWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  type: AlarmType;
  onComplete: (settings: Partial<AlarmSettings>) => void;
};

const AlarmSetupWizard = ({ isOpen, onClose, type, onComplete }: AlarmSetupWizardProps) => {
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [selectedTimeOption, setSelectedTimeOption] = useState<string>("30before");
  const [selectedSnooze, setSelectedSnooze] = useState<number>(5);
  const [selectedChallenge, setSelectedChallenge] = useState<AlarmChallengeType>("none");

  // Challenge configuration
  const [mathDifficulty, setMathDifficulty] = useState<MathDifficulty>("easy");
  const [mathQuestionCount, setMathQuestionCount] = useState<number>(1);
  const [tapCount, setTapCount] = useState<number>(10);
  const [challengeGracePeriodSec, setChallengeGracePeriodSec] = useState<number>(15);

  const isFajr = type === "fajr";
  const TitleIcon = isFajr ? Sun : CalendarDays;
  const prayerName = isFajr ? t("prayer.fajr", "Fajr") : t("prayer.jummah", "Jummah");

  // Time options for step 1
  const timeOptions: TimeOption[] = isFajr
    ? [
        {
          id: "30before",
          offsetMinutes: -30,
          label: t("alarm.wizard.option.30before", "30 minutes before {{prayer}}", {
            prayer: prayerName,
          }),
        },
        {
          id: "15before",
          offsetMinutes: -15,
          label: t("alarm.wizard.option.15before", "15 minutes before {{prayer}}", {
            prayer: prayerName,
          }),
        },
        {
          id: "atPrayer",
          offsetMinutes: 0,
          label: t("alarm.wizard.option.atPrayer", "At {{prayer}} time", { prayer: prayerName }),
        },
      ]
    : [
        {
          id: "60before",
          offsetMinutes: -60,
          label: t("alarm.wizard.option.60before", "1 hour before {{prayer}}", {
            prayer: prayerName,
          }),
        },
        {
          id: "30before",
          offsetMinutes: -30,
          label: t("alarm.wizard.option.30before", "30 minutes before {{prayer}}", {
            prayer: prayerName,
          }),
        },
        {
          id: "15before",
          offsetMinutes: -15,
          label: t("alarm.wizard.option.15before", "15 minutes before {{prayer}}", {
            prayer: prayerName,
          }),
        },
      ];

  const snoozeDurations = [5, 10, 15];
  const challengeTypes: { id: AlarmChallengeType; label: string }[] = [
    { id: "none", label: t("alarm.wizard.challenge.none", "None") },
    { id: "math", label: t("alarm.wizard.challenge.math", "Math") },
    { id: "tap", label: t("alarm.wizard.challenge.tap", "Tap") },
  ];

  // Challenge configuration options
  const mathDifficultyOptions: { id: MathDifficulty; label: string }[] = [
    { id: "easy", label: t("alarm.wizard.difficulty.easy", "Easy") },
    { id: "medium", label: t("alarm.wizard.difficulty.medium", "Medium") },
    { id: "hard", label: t("alarm.wizard.difficulty.hard", "Hard") },
  ];

  const mathQuestionOptions = [1, 2, 3, 5];
  const tapCountOptions = [10, 20, 30, 50];
  const gracePeriodOptions = [0, 10, 15, 30];

  // Calculate total steps (3 if challenge selected on Android, else 2)
  const hasChallenge = selectedChallenge !== "none" && Platform.OS === "android";
  const totalSteps = hasChallenge ? 3 : 2;

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && hasChallenge) {
      // Go to challenge configuration step
      setStep(3);
    } else {
      // Complete the wizard (step 2 without challenge, or step 3 with challenge)
      const selectedOption = timeOptions.find((opt) => opt.id === selectedTimeOption);
      onComplete({
        enabled: true,
        hasCompletedSetup: true,
        timeMode: "dynamic",
        offsetMinutes: selectedOption?.offsetMinutes ?? -30,
        snoozeEnabled: selectedSnooze > 0,
        snoozeDurationMinutes: selectedSnooze || 5,
        challengeEnabled: selectedChallenge !== "none",
        challengeType: selectedChallenge,
        mathDifficulty,
        mathQuestionCount,
        tapCount,
        challengeGracePeriodSec,
      });
      resetWizard();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedTimeOption("30before");
    setSelectedSnooze(5);
    setSelectedChallenge("none");
    setMathDifficulty("easy");
    setMathQuestionCount(1);
    setTapCount(10);
    setChallengeGracePeriodSec(15);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalBackdrop />
      <ModalContent className="bg-background-secondary mx-4 rounded-2xl shadow-xl relative max-h-[80%]">
        <ModalCloseButton className="absolute top-4 right-4 z-10">
          <Icon as={X} className="text-typography-secondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader className="justify-items-center px-6 pt-6 pb-4 pr-12">
          <VStack className="items-center" space="sm">
            <Box className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center">
              <Icon as={TitleIcon} className="text-primary-500" size="xl" />
            </Box>
            <Text className="text-xl font-bold text-typography text-center">
              {isFajr
                ? t("alarm.wizard.title.fajr", "Set Fajr Alarm")
                : t("alarm.wizard.title.jummah", "Set Jummah Alarm")}
            </Text>
            {/* Step indicator */}
            <HStack className="items-center gap-2 mt-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <Box
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    step === i + 1 ? "bg-primary-500" : "bg-typography-tertiary"
                  }`}
                />
              ))}
            </HStack>
          </VStack>
        </ModalHeader>

        <ModalBody className="px-6 py-2">
          {step === 1 && (
            <VStack space="md">
              <Text className="text-center text-typography-secondary mb-2">
                {t("alarm.wizard.whenWakeUp", "When do you want to wake up?")}
              </Text>

              {timeOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedTimeOption(option.id)}
                  className={`p-4 rounded-xl border-2 ${
                    selectedTimeOption === option.id
                      ? "border-primary-500 bg-primary-500/10"
                      : "border-outline bg-background"
                  }`}>
                  <HStack className="items-center justify-between">
                    <HStack className="items-center gap-3">
                      <Icon
                        as={Clock}
                        size="md"
                        className={
                          selectedTimeOption === option.id
                            ? "text-primary-500"
                            : "text-typography-secondary"
                        }
                      />
                      <Text
                        className={`text-base ${
                          selectedTimeOption === option.id
                            ? "text-primary-500 font-semibold"
                            : "text-typography"
                        }`}>
                        {option.label}
                      </Text>
                    </HStack>
                    {selectedTimeOption === option.id && (
                      <Box className="w-5 h-5 rounded-full bg-primary-500 items-center justify-center">
                        <Text className="text-white text-xs">✓</Text>
                      </Box>
                    )}
                  </HStack>
                </Pressable>
              ))}
            </VStack>
          )}

          {step === 2 && (
            <VStack space="lg">
              {/* Snooze Duration */}
              <VStack space="sm">
                <Text className="text-typography-secondary font-medium">
                  {t("alarm.wizard.snooze", "Snooze Duration")}
                </Text>
                <HStack className="gap-3">
                  {snoozeDurations.map((duration) => (
                    <Pressable
                      key={duration}
                      onPress={() => setSelectedSnooze(duration)}
                      className={`flex-1 py-3 rounded-xl ${
                        selectedSnooze === duration
                          ? "bg-primary-500"
                          : "bg-background border border-outline"
                      }`}>
                      <Text
                        className={`text-center font-medium ${
                          selectedSnooze === duration ? "text-white" : "text-typography"
                        }`}>
                        {duration} {t("alarm.wizard.min", "min")}
                      </Text>
                    </Pressable>
                  ))}
                </HStack>
              </VStack>

              {/* Challenge Type - Android only (iOS AlarmKit handles its own UI) */}
              {Platform.OS === "android" && (
                <VStack space="sm">
                  <Text className="text-typography-secondary font-medium">
                    {t("alarm.wizard.dismissChallenge", "Dismiss Challenge")}
                  </Text>
                  <HStack className="gap-3">
                    {challengeTypes.map((challenge) => (
                      <Pressable
                        key={challenge.id}
                        onPress={() => setSelectedChallenge(challenge.id)}
                        className={`flex-1 py-3 rounded-xl ${
                          selectedChallenge === challenge.id
                            ? "bg-primary-500"
                            : "bg-background border border-outline"
                        }`}>
                        <Text
                          className={`text-center font-medium ${
                            selectedChallenge === challenge.id ? "text-white" : "text-typography"
                          }`}>
                          {challenge.label}
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              )}

              <Text className="text-center text-typography-tertiary text-sm mt-2">
                {t("alarm.wizard.canChangeLater", "You can change these later")}
              </Text>
            </VStack>
          )}

          {step === 3 && (
            <VStack space="lg">
              <Text className="text-center text-typography-secondary mb-2">
                {t("alarm.wizard.configureChallengeTitle", "Configure your challenge")}
              </Text>

              {/* Math Challenge Configuration */}
              {selectedChallenge === "math" && (
                <>
                  {/* Difficulty */}
                  <VStack space="sm">
                    <Text className="text-typography-secondary font-medium">
                      {t("alarm.wizard.mathDifficulty", "Difficulty")}
                    </Text>
                    <HStack className="gap-3">
                      {mathDifficultyOptions.map((option) => (
                        <Pressable
                          key={option.id}
                          onPress={() => setMathDifficulty(option.id)}
                          className={`flex-1 py-3 rounded-xl ${
                            mathDifficulty === option.id
                              ? "bg-primary-500"
                              : "bg-background border border-outline"
                          }`}>
                          <Text
                            className={`text-center font-medium ${
                              mathDifficulty === option.id ? "text-white" : "text-typography"
                            }`}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </VStack>

                  {/* Number of questions */}
                  <VStack space="sm">
                    <Text className="text-typography-secondary font-medium">
                      {t("alarm.wizard.mathQuestions", "Number of problems")}
                    </Text>
                    <HStack className="gap-3">
                      {mathQuestionOptions.map((count) => (
                        <Pressable
                          key={count}
                          onPress={() => setMathQuestionCount(count)}
                          className={`flex-1 py-3 rounded-xl ${
                            mathQuestionCount === count
                              ? "bg-primary-500"
                              : "bg-background border border-outline"
                          }`}>
                          <Text
                            className={`text-center font-medium ${
                              mathQuestionCount === count ? "text-white" : "text-typography"
                            }`}>
                            {count}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </VStack>
                </>
              )}

              {/* Tap Challenge Configuration */}
              {selectedChallenge === "tap" && (
                <VStack space="sm">
                  <Text className="text-typography-secondary font-medium">
                    {t("alarm.wizard.tapCount", "Number of taps")}
                  </Text>
                  <HStack className="gap-3">
                    {tapCountOptions.map((count) => (
                      <Pressable
                        key={count}
                        onPress={() => setTapCount(count)}
                        className={`flex-1 py-3 rounded-xl ${
                          tapCount === count
                            ? "bg-primary-500"
                            : "bg-background border border-outline"
                        }`}>
                        <Text
                          className={`text-center font-medium ${
                            tapCount === count ? "text-white" : "text-typography"
                          }`}>
                          {count}
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              )}

              {/* Grace Period (common to both) */}
              <VStack space="sm">
                <Text className="text-typography-secondary font-medium">
                  {t("alarm.wizard.gracePeriod", "Grace period (seconds)")}
                </Text>
                <HStack className="gap-3">
                  {gracePeriodOptions.map((seconds) => (
                    <Pressable
                      key={seconds}
                      onPress={() => setChallengeGracePeriodSec(seconds)}
                      className={`flex-1 py-3 rounded-xl ${
                        challengeGracePeriodSec === seconds
                          ? "bg-primary-500"
                          : "bg-background border border-outline"
                      }`}>
                      <Text
                        className={`text-center font-medium ${
                          challengeGracePeriodSec === seconds ? "text-white" : "text-typography"
                        }`}>
                        {seconds === 0 ? t("alarm.wizard.none", "None") : `${seconds}s`}
                      </Text>
                    </Pressable>
                  ))}
                </HStack>
                <Text className="text-center text-typography-tertiary text-xs">
                  {t("alarm.wizard.gracePeriodHint", "Alarm mutes while you solve the challenge")}
                </Text>
              </VStack>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter className="px-6 py-6">
          <VStack space="sm" className="w-full">
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.7}
              style={{
                backgroundColor: "#10b981",
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
              }}>
              <Text className="text-white font-semibold text-base">
                {step < totalSteps
                  ? t("alarm.wizard.continue", "Continue")
                  : t("alarm.wizard.save", "Save Alarm")}
              </Text>
            </TouchableOpacity>

            {step > 1 && (
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.7}
                style={{
                  borderWidth: 1,
                  borderColor: "#6b7280",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}>
                <Text className="text-typography font-medium text-base">
                  {t("common.back", "Back")}
                </Text>
              </TouchableOpacity>
            )}
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AlarmSetupWizard;
