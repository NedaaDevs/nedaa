import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, Keyboard } from "react-native";
import { announceMiss } from "@/components/alarm/challenges/announceMiss";
import { useTheme } from "@/components/ui/theme-color";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/ui/box";

import { ChallengeDifficulty, DhikrPhrase } from "@/types/alarm";
import { pickDhikrPhrase, submitDhikr } from "@/utils/dhikrChallenge";
import { useHaptic } from "@/hooks/useHaptic";
import { DHIKR_TYPED } from "@/constants/DhikrTask";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

type Props = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
};

// Kept across the shell's remount of each step, and across strike resets,
// so the next phrase avoids the one just shown.
let lastDhikrPhrase: DhikrPhrase | null = null;

const DhikrChallenge: FC<Props> = ({ difficulty, onComplete }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const hapticError = useHaptic(HAPTIC_FEEDBACK.ERROR);

  const [phrase, setPhrase] = useState<DhikrPhrase>(() => {
    const picked = pickDhikrPhrase(difficulty, lastDhikrPhrase);
    lastDhikrPhrase = picked;
    return picked;
  });

  const [userInput, setUserInput] = useState("");
  const [isWrong, setIsWrong] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();

    const { outcome, strikes } = submitDhikr(userInput, phrase, strikeCount);
    if (outcome === DHIKR_TYPED.SOLVED) {
      hapticSuccess();
      onComplete();
    } else {
      hapticError();
      setIsWrong(true);
      setStrikeCount(strikes);

      if (outcome === DHIKR_TYPED.NEXT) {
        setUserInput("");
        const picked = pickDhikrPhrase(difficulty, phrase);
        lastDhikrPhrase = picked;
        setPhrase(picked);
        announceMiss(
          t("a11y.alarm.newDhikr", {
            arabic: picked.arabic,
            transliteration: picked.transliteration,
          })
        );
      } else {
        announceMiss(t("alarm.challenge.wrongAnswer"));
      }

      setTimeout(() => setIsWrong(false), 500);
    }
  }, [userInput, phrase, strikeCount, difficulty, onComplete, hapticSuccess, hapticError, t]);

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Text size="sm" color="$typographySecondary" marginBottom="$2">
        {t("alarm.task.dhikrHint")}
      </Text>

      <Box
        padding="$6"
        borderRadius="$6"
        backgroundColor="$backgroundMuted"
        borderWidth={2}
        borderColor={isWrong ? "$borderError" : "transparent"}
        width="100%"
        accessible
        accessibilityLabel={t("a11y.alarm.dhikrPhrase", {
          arabic: phrase.arabic,
          transliteration: phrase.transliteration,
        })}>
        <VStack gap="$2" alignItems="center">
          <Text
            size="4xl"
            bold
            color="$typography"
            textAlign="center"
            style={{ writingDirection: "rtl", lineHeight: 56 }}>
            {phrase.arabic}
          </Text>
          <Text size="lg" color="$typographySecondary" textAlign="center">
            {phrase.transliteration}
          </Text>
        </VStack>
      </Box>

      <TextInput
        value={userInput}
        onChangeText={setUserInput}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder={t("alarm.challenge.dhikrPlaceholder")}
        placeholderTextColor={theme.placeholderColor.val}
        accessibilityLabel={t("alarm.challenge.dhikrPlaceholder")}
        contextMenuHidden
        autoFocus
        style={{
          width: "100%",
          fontSize: 22,
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

      <Button size="xl" width="100%" marginTop="$4" onPress={handleSubmit} disabled={!userInput}>
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

export default DhikrChallenge;
