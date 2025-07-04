import plugin from "tailwindcss/plugin";

/**
 * Plugin that creates dynamic font utilities that respect the current locale
 * - Uses IBM Plex sans for Arabic locale
 * - Uses Asap for all other locales
 *
 * This allows using classes like font-regular, font-medium, font-semibold, font-bold
 * which will automatically map to the correct font family based on the current locale
 *
 */
export const fontPlugin = plugin(({ addUtilities, addBase }) => {
  // Add base CSS variables for font families
  addBase({
    ":root": {
      "--font-regular": "Asap-Regular",
      "--font-medium": "Asap-Medium",
      "--font-semibold": "Asap-SemiBold",
      "--font-bold": "Asap-Bold",
    },
  });

  // Create dynamic font utilities that use CSS variables
  const fontUtilities = {
    ".font-regular": {
      fontFamily: "var(--font-regular)",
    },
    ".font-medium": {
      fontFamily: "var(--font-medium)",
    },
    ".font-semibold": {
      fontFamily: "var(--font-semibold)",
    },
    ".font-bold": {
      fontFamily: "var(--font-bold)",
    },
  };

  addUtilities(fontUtilities);
});

export default fontPlugin;
