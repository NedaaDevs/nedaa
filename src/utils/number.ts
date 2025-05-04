import appStore from "@/stores/app";

export const formatNumberToLocale = (str: string) => {
  if (appStore.getState().locale.startsWith("ar")) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return str.replace(/[0-9]/g, (digit: string): string => arabicDigits[parseInt(digit)]);
  }
  return str;
};
