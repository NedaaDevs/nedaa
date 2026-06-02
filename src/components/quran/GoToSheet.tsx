import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { TOTAL_PAGES, QURAN_FONT_FAMILY } from "@/constants/Quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { Segmented } from "@/components/quran/settings/SettingsControls";
import type { SurahMeta } from "@/types/quran";

type GoToTab = "surah" | "juz" | "hizb" | "page";

interface GoToSheetProps {
  onGoTo: (page: number) => void;
  onClose: () => void;
}

const GoToSheet = ({ onGoTo, onClose }: GoToSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  const [tab, setTab] = useState<GoToTab>("surah");
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [juz, setJuz] = useState<{ division: number; page: number }[]>([]);
  const [hizb, setHizb] = useState<{ division: number; page: number }[]>([]);
  const [pageInput, setPageInput] = useState("");

  useEffect(() => {
    QuranContentDB.getAllSurahs().then(setSurahs);
    QuranContentDB.getJuzStartPages().then(setJuz);
    QuranContentDB.getHizbStartPages().then(setHizb);
  }, []);

  const go = (page: number) => {
    onGoTo(page);
    onClose();
  };

  const submitPage = () => {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) go(Math.max(1, Math.min(TOTAL_PAGES, n)));
  };

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(reduceMotion ? 150 : 200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      </Animated.View>

      <Animated.View
        entering={
          reduceMotion ? FadeIn.duration(150) : SlideInDown.springify().damping(20).stiffness(200)
        }
        exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          { backgroundColor: chrome.background, paddingBottom: insets.bottom + 8 },
        ]}>
        <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3">
          <Text fontSize={18} fontWeight="700">
            {t("quran.goto.title")}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}>
            <YStack
              width={32}
              height={32}
              borderRadius={16}
              backgroundColor={chrome.cardBorder}
              alignItems="center"
              justifyContent="center">
              <X color={chrome.subtleText} size={16} />
            </YStack>
          </Pressable>
        </XStack>

        <Segmented
          chrome={chrome}
          compact
          selected={tab}
          onSelect={setTab}
          options={[
            { value: "surah", label: t("quran.goto.surah") },
            { value: "juz", label: t("quran.goto.juz") },
            { value: "hizb", label: t("quran.goto.hizb") },
            { value: "page", label: t("quran.goto.page") },
          ]}
        />

        {tab === "page" ? (
          <XStack gap="$2" alignItems="center" paddingTop="$4">
            <TextInput
              value={pageInput}
              onChangeText={setPageInput}
              onSubmitEditing={submitPage}
              keyboardType="number-pad"
              returnKeyType="go"
              placeholder={t("quran.goto.pagePrompt", { total: TOTAL_PAGES })}
              placeholderTextColor={chrome.subtleText}
              style={{
                flex: 1,
                height: 44,
                borderWidth: 1,
                borderColor: chrome.cardBorder,
                borderRadius: 12,
                paddingHorizontal: 14,
                color: chrome.subtleText,
                fontSize: 15,
              }}
            />
            <Pressable
              onPress={submitPage}
              accessibilityRole="button"
              accessibilityLabel={t("quran.goto.go")}>
              <YStack
                backgroundColor={chrome.accent}
                paddingHorizontal="$4"
                height={44}
                borderRadius={12}
                alignItems="center"
                justifyContent="center">
                <Text color="#fff" fontWeight="700" fontSize={15}>
                  {t("quran.goto.go")}
                </Text>
              </YStack>
            </Pressable>
          </XStack>
        ) : (
          <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
            <YStack paddingVertical="$2">
              {tab === "surah" &&
                surahs.map((s) => (
                  <Row
                    key={s.number}
                    chrome={chrome}
                    onPress={() => go(s.pageStart)}
                    leading={`${s.number}`}
                    title={s.nameTransliterated}
                    arabic={s.nameArabic}
                    page={s.pageStart}
                  />
                ))}
              {tab === "juz" &&
                juz.map((j) => (
                  <Row
                    key={j.division}
                    chrome={chrome}
                    onPress={() => go(j.page)}
                    leading={`${j.division}`}
                    title={t("quran.goto.juzLabel", { n: j.division })}
                    page={j.page}
                  />
                ))}
              {tab === "hizb" &&
                hizb.map((h) => (
                  <Row
                    key={h.division}
                    chrome={chrome}
                    onPress={() => go(h.page)}
                    leading={`${h.division}`}
                    title={t("quran.goto.hizbLabel", { n: h.division })}
                    page={h.page}
                  />
                ))}
            </YStack>
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
};

const Row = ({
  chrome,
  onPress,
  leading,
  title,
  arabic,
  page,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  onPress: () => void;
  leading: string;
  title: string;
  arabic?: string;
  page: number;
}) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title} · ${page}`}>
    <XStack alignItems="center" gap="$3" paddingVertical="$2.5" paddingHorizontal="$2">
      <Text fontSize={13} color={chrome.subtleText} minWidth={26} textAlign="center">
        {leading}
      </Text>
      <Text flex={1} fontSize={15} fontWeight="500">
        {title}
      </Text>
      {arabic ? (
        <Text fontSize={16} style={{ fontFamily: QURAN_FONT_FAMILY }}>
          {arabic}
        </Text>
      ) : null}
      <Text fontSize={12} color={chrome.subtleText} minWidth={32} textAlign="right">
        {page}
      </Text>
    </XStack>
  </Pressable>
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 11,
  },
});

export default GoToSheet;
