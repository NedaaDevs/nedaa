import { FC, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, Keyboard } from "react-native";
import { useTheme } from "tamagui";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/ui/box";

import { ChallengeDifficulty, CHALLENGE_DIFFICULTY_CONFIG } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Operation = "+" | "-" | "*";

interface MathProblem {
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
}

type Props = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
};

const generateProblem = (difficulty: ChallengeDifficulty): MathProblem => {
  const config = CHALLENGE_DIFFICULTY_CONFIG.math[difficulty];
  const maxNum = config.maxNumber;
  const operations = config.operations as readonly Operation[];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  let num1 = Math.floor(Math.random() * maxNum) + 1;
  let num2 = Math.floor(Math.random() * maxNum) + 1;

  if (operation === "-" && num1 < num2) {
    [num1, num2] = [num2, num1];
  }

  if (operation === "*") {
    num1 = Math.floor(Math.random() * 12) + 1;
    num2 = Math.floor(Math.random() * 12) + 1;
  }

  let answer: number;
  switch (operation) {
    case "+":
      answer = num1 + num2;
      break;
    case "-":
      answer = num1 - num2;
      break;
    case "*":
      answer = num1 * num2;
      break;
  }

  return { num1, num2, operation, answer };
};

const MathChallenge: FC<Props> = ({ difficulty, onComplete }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticSuccess = useHaptic("success");
  const hapticError = useHaptic("error");

  const [problem, setProblem] = useState<MathProblem>(() => generateProblem(difficulty));
  const [userAnswer, setUserAnswer] = useState("");
  const [isWrong, setIsWrong] = useState(false);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    const parsedAnswer = parseInt(userAnswer, 10);

    if (parsedAnswer === problem.answer) {
      hapticSuccess();
      onComplete();
    } else {
      hapticError();
      setIsWrong(true);
      setUserAnswer("");
      setProblem(generateProblem(difficulty));
      setTimeout(() => setIsWrong(false), 500);
    }
  }, [userAnswer, problem.answer, difficulty, onComplete, hapticSuccess, hapticError]);

  const operationSymbol = useMemo(() => {
    switch (problem.operation) {
      case "+":
        return "+";
      case "-":
        return "−";
      case "*":
        return "×";
    }
  }, [problem.operation]);

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Text size="sm" color="$typographySecondary" marginBottom="$2">
        {t("alarm.challenge.solveMath")}
      </Text>

      <Box
        padding="$6"
        borderRadius="$6"
        backgroundColor={isWrong ? "$backgroundError" : "$backgroundMuted"}>
        <Text size="4xl" bold color="$typography" textAlign="center">
          {problem.num1} {operationSymbol} {problem.num2} = ?
        </Text>
      </Box>

      <TextInput
        value={userAnswer}
        onChangeText={(text) => {
          setUserAnswer(text.replace(/[^0-9-]/g, ""));
        }}
        keyboardType="numeric"
        placeholder={t("alarm.challenge.enterAnswer")}
        placeholderTextColor={theme.placeholderColor.val}
        autoFocus
        style={{
          width: "100%",
          fontSize: 24,
          fontWeight: "700",
          textAlign: "center",
          padding: 16,
          borderRadius: 12,
          backgroundColor: theme.backgroundMuted.val,
          color: theme.typography.val,
          ...(isWrong && { borderWidth: 2, borderColor: theme.error.val }),
        }}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />

      <Button size="xl" width="100%" marginTop="$4" onPress={handleSubmit} disabled={!userAnswer}>
        <Button.Text size="lg">{t("alarm.challenge.submit")}</Button.Text>
      </Button>

      {isWrong && (
        <Text color="$error" size="sm">
          {t("alarm.challenge.wrongAnswer")}
        </Text>
      )}
    </VStack>
  );
};

export default MathChallenge;
