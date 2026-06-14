import { ActivityIndicator, Pressable } from "react-native";
import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";

interface QuranDbGateProps {
  // "loading" → spinner; "error" → message + retry. Rendered in place of the
  // reader until the content DB is ready.
  state: "loading" | "error";
  quranTheme: QuranThemeType;
  onRetry: () => void;
}

// Stand-in shown while the bundled Quran DB is copied/opened (or if that fails),
// so the reader never renders an empty page assuming the data is already there.
// Painted on the reader's paper so there's no color flash into the reader.
const QuranDbGate = ({ state, quranTheme, onRetry }: QuranDbGateProps) => {
  const { t } = useTranslation();
  const colors = QURAN_THEME_COLORS[quranTheme];

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      paddingHorizontal="$6"
      style={{ backgroundColor: colors.background }}>
      {state === "loading" ? (
        <>
          <ActivityIndicator color={colors.headerColor} />
          <Text size="md" style={{ color: colors.textTint ?? colors.headerColor }}>
            {t("quran.db.preparing")}
          </Text>
        </>
      ) : (
        <>
          <Text size="md" style={{ color: colors.headerColor, textAlign: "center" }}>
            {t("quran.db.error")}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("quran.db.retry")}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.headerColor,
            }}>
            <Text size="md" bold style={{ color: colors.headerColor }}>
              {t("quran.db.retry")}
            </Text>
          </Pressable>
        </>
      )}
    </YStack>
  );
};

export default QuranDbGate;
