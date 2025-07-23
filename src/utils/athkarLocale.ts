// List of locales that support athkar feature
const ATHKAR_SUPPORTED_LOCALES = ["ar"];

/**
 * Check if the current locale supports athkar feature
 * @param locale
 * @returns boolean indicating if athkar is supported
 */
export const isAthkarSupported = (locale: string): boolean => {
  // Extract the base language code (e.g., 'ar' from 'ar-SA')
  const baseLocale = locale.split("-")[0];
  return ATHKAR_SUPPORTED_LOCALES.includes(baseLocale);
};

export { ATHKAR_SUPPORTED_LOCALES };
