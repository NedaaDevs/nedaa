import { FC, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, Keyboard } from "react-native";
import { useTheme } from "tamagui";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/ui/box";

import { ChallengeDifficulty, DhikrPhrase } from "@/types/alarm";
import { matchesDhikr, pickDhikrPhrase } from "@/utils/dhikrChallenge";
import { useHaptic } from "@/hooks/useHaptic";

// Wrong submissions before the phrase resets — lets a typo be fixed in place
// instead of losing the attempt on every miss. Mirrored in the Android
// overlay's onDhikrSubmitted.
const STRIKE_THRESHOLD = 3;

type Props = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
  onInteraction?: () => void;
};

// Remembered across the wrapper's per-round remounts (and mid-round strike
// resets) so the next phrase avoids the one just shown.
let lastDhikrPhrase: DhikrPhrase | null = null;

const DhikrChallenge: FC<Props> = ({ difficulty, onComplete, onInteraction }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticSuccess = useHaptic("success");
  const hapticError = useHaptic("error");

  const [phrase, setPhrase] = useState<DhikrPhrase>(() => {
    const picked = pickDhikrPhrase(difficulty, lastDhikrPhrase);
    lastDhikrPhrase = picked;
    return picked;
  });

  const [userInput, setUserInput] = useState("");
  const [isWrong, setIsWrong] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);

  const handleSubmit = useCallback(() => {
    onInteraction?.();
    Keyboard.dismiss();

    if (matchesDhikr(userInput, phrase)) {
      hapticSuccess();
      onComplete();
    } else {
      hapticError();
      setIsWrong(true);

      const nextStrikes = strikeCount + 1;
      if (nextStrikes >= STRIKE_THRESHOLD) {
        // Too many misses on this phrase — fresh phrase, clean slate.
        setStrikeCount(0);
        setUserInput("");
        const picked = pickDhikrPhrase(difficulty, phrase);
        lastDhikrPhrase = picked;
        setPhrase(picked);
      } else {
        // Keep the same phrase and typed text so a typo can be fixed in place.
        setStrikeCount(nextStrikes);
      }

      setTimeout(() => setIsWrong(false), 500);
    }
  }, [
    userInput,
    phrase,
    strikeCount,
    difficulty,
    onComplete,
    onInteraction,
    hapticSuccess,
    hapticError,
  ]);

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Text size="sm" color="$typographySecondary" marginBottom="$2">
        {t("alarm.challenge.typeDhikr")}
      </Text>

      <Box
        padding="$6"
        borderRadius="$6"
        backgroundColor="$backgroundMuted"
        borderWidth={2}
        borderColor={isWrong ? "$borderError" : "transparent"}
        width="100%"
        accessibilityLabel={t("a11y.alarm.dhikrPhrase", {
          transliteration: phrase.transliteration,
        })}
        accessibilityLiveRegion="polite">
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
        onChangeText={(text) => {
          onInteraction?.();
          setUserInput(text);
        }}
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
        <Text color="$error" size="sm" accessibilityLiveRegion="assertive">
          {t("alarm.challenge.wrongAnswer")}
        </Text>
      )}
    </VStack>
  );
};

export default DhikrChallenge;
