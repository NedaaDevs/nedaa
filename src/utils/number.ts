import appStore from "@/stores/app";

export const formatNumberToLocale = (str: string) => {
  if (appStore.getState().locale.startsWith("ar")) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return str.replace(/[0-9]/g, (digit: string): string => arabicDigits[parseInt(digit)]);
  }
  return str;
};

export const normalizeNumber = (str: string) => {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
};
