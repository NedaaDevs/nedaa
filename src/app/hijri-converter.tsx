import { useState, useMemo } from "react";
import { ScrollView, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MotiView } from "moti";

import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import HijriWheelPicker from "@/components/hijri/HijriWheelPicker";

import { HijriNative, type HijriDate, getDateLocale } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";

import { ArrowUpDown, TriangleAlert, Copy, Check, Info } from "lucide-react-native";

import { useHaptic } from "@/hooks/useHaptic";

type Direction = "gregorianToHijri" | "hijriToGregorian";

const HijriConverterScreen = () => {
  const { t } = useTranslation();

  const { locale, hijriDaysOffset } = useAppStore();
  const { locationDetails } = useLocationStore();
  const selectionHaptic = useHaptic("selection");

  const [direction, setDirection] = useState<Direction>("hijriToGregorian");
  const [copied, setCopied] = useState(false);
  const [gregorianDate, setGregorianDate] = useState(() => new Date());
  const [hijriDate, setHijriDate] = useState<HijriDate>(() =>
    HijriNative.today(locationDetails.timezone)
  );
  const [showGregorianPicker, setShowGregorianPicker] = useState(false);
  const [swapCount, setSwapCount] = useState(0);

  const convertedResult = useMemo(() => {
    if (direction === "gregorianToHijri") {
      const result = HijriNative.toHijri(
        gregorianDate.getFullYear(),
        gregorianDate.getMonth() + 1,
        gregorianDate.getDate()
      );
      if (hijriDaysOffset !== 0) {
        return HijriNative.addDays(result, hijriDaysOffset);
      }
      return result;
    }
    return HijriNative.toGregorian(hijriDate.year, hijriDate.month, hijriDate.day);
  }, [direction, gregorianDate, hijriDate, hijriDaysOffset]);

  const formattedResult = useMemo(() => {
    if (direction === "gregorianToHijri") {
      const hijri = convertedResult as HijriDate;
      const day = formatNumberToLocale(hijri.day.toString());
      const month = t(`hijriMonths.${hijri.month - 1}`);
      const year = formatNumberToLocale(hijri.year.toString());
      return `${day} ${month} ${year} \u0647\u0640`;
    }
    const greg = convertedResult as HijriDate;
    const date = new Date(greg.year, greg.month - 1, greg.day);
    return formatNumberToLocale(format(date, "dd MMMM yyyy", { locale: getDateLocale(locale) }));
  }, [direction, convertedResult, locale, t]);

  const handleSwap = async () => {
    await selectionHaptic();
    setSwapCount((c) => c + 1);

    if (direction === "gregorianToHijri") {
      const hijriResult = convertedResult as HijriDate;
      const unbiased =
        hijriDaysOffset !== 0 ? HijriNative.addDays(hijriResult, -hijriDaysOffset) : hijriResult;
      setHijriDate(unbiased);
    } else {
      const gregResult = convertedResult as HijriDate;
      setGregorianDate(new Date(gregResult.year, gregResult.month - 1, gregResult.day));
    }

    setDirection((d) => (d === "gregorianToHijri" ? "hijriToGregorian" : "gregorianToHijri"));
  };

  const copyResult = async () => {
    await selectionHaptic();
    await Clipboard.setStringAsync(formattedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fromLabel =
    direction === "gregorianToHijri"
      ? `${t("tools.hijriConverter.from")}: ${t("tools.hijriConverter.gregorian")}`
      : `${t("tools.hijriConverter.from")}: ${t("tools.hijriConverter.hijri")}`;

  const toLabel =
    direction === "gregorianToHijri"
      ? `${t("tools.hijriConverter.to")}: ${t("tools.hijriConverter.hijri")}`
      : `${t("tools.hijriConverter.to")}: ${t("tools.hijriConverter.gregorian")}`;

  return (
    <Background>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TopBar title={t("tools.hijriConverter.title")} href="/(tabs)/tools" backOnClick />

        <Box padding="$4">
          <Box backgroundColor="$backgroundSecondary" padding="$5" borderRadius="$6">
            <Text
              size="md"
              fontWeight="600"
              color="$typographySecondary"
              marginBottom="$3"
              accessibilityRole="header">
              {fromLabel}
            </Text>

            {direction === "gregorianToHijri" ? (
              <>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={gregorianDate}
                    mode="date"
                    display="inline"
                    onChange={(_event, selectedDate) => {
                      if (selectedDate) setGregorianDate(selectedDate);
                    }}
                    locale={locale}
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => setShowGregorianPicker(true)}
                      backgroundColor="$backgroundSecondary"
                      padding="$3"
                      borderRadius="$4"
                      accessibilityRole="button"
                      accessibilityLabel={formatNumberToLocale(
                        format(gregorianDate, "dd MMMM yyyy", { locale: getDateLocale(locale) })
                      )}>
                      <Text color="$typography" fontWeight="500" size="lg">
                        {formatNumberToLocale(
                          format(gregorianDate, "dd MMMM yyyy", {
                            locale: getDateLocale(locale),
                          })
                        )}
                      </Text>
                    </Pressable>
                    {showGregorianPicker && (
                      <DateTimePicker
                        value={gregorianDate}
                        mode="date"
                        display="default"
                        onChange={(_event, selectedDate) => {
                          setShowGregorianPicker(false);
                          if (selectedDate) setGregorianDate(selectedDate);
                        }}
                        locale={locale}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <HijriWheelPicker value={hijriDate} onChange={setHijriDate} />
            )}
          </Box>

          <Box alignItems="center" marginVertical="$3">
            <Pressable
              onPress={handleSwap}
              padding="$3"
              borderRadius="$10"
              backgroundColor="$backgroundSecondary"
              minWidth={44}
              minHeight={44}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("a11y.hijriConverter.swap")}>
              <MotiView
                animate={{ rotate: swapCount * 180 + "deg" }}
                transition={{ type: "timing", duration: 300 }}>
                <Icon as={ArrowUpDown} color="$accentPrimary" size="lg" />
              </MotiView>
            </Pressable>
          </Box>

          <Box backgroundColor="$backgroundSecondary" padding="$5" borderRadius="$6">
            <Text
              size="md"
              fontWeight="600"
              color="$typographySecondary"
              marginBottom="$3"
              accessibilityRole="header">
              {toLabel}
            </Text>
            <Text
              size="2xl"
              fontWeight="700"
              color="$typography"
              accessibilityLiveRegion="polite"
              accessibilityLabel={t("a11y.hijriConverter.result", { date: formattedResult })}>
              {formattedResult}
            </Text>
          </Box>

          {hijriDaysOffset !== 0 && direction === "gregorianToHijri" && (
            <HStack marginTop="$3" gap="$2" alignItems="center">
              <Icon as={Info} color="$typographySecondary" size="xs" />
              <Text size="xs" color="$typographySecondary">
                {t("tools.hijriConverter.offsetNote", {
                  offset: formatNumberToLocale(hijriDaysOffset.toString()),
                })}
              </Text>
            </HStack>
          )}

          <HStack marginTop="$4" gap="$2" alignItems="flex-start">
            <Icon as={TriangleAlert} size="sm" color="$typographySecondary" />
            <Text
              size="xs"
              color="$typographySecondary"
              flex={1}
              accessibilityLabel={t("a11y.hijriConverter.disclaimer")}>
              {t("tools.hijriConverter.disclaimer")}
            </Text>
          </HStack>

          <Pressable
            onPress={copyResult}
            marginTop="$4"
            backgroundColor={copied ? "$success" : "$accentPrimary"}
            padding="$4"
            borderRadius="$6"
            minHeight={48}
            accessibilityRole="button"
            accessibilityLabel={t("tools.hijriConverter.copyResult")}>
            <HStack alignItems="center" justifyContent="center" gap="$2">
              <Icon as={copied ? Check : Copy} color="$typographyContrast" size="md" />
              <Text color="$typographyContrast" fontWeight="600">
                {copied ? t("tools.hijriConverter.copied") : t("tools.hijriConverter.copyResult")}
              </Text>
            </HStack>
          </Pressable>
        </Box>
      </ScrollView>
    </Background>
  );
};

export default HijriConverterScreen;
