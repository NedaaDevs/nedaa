"use client";
import { vars } from "nativewind";

export const config = {
  light: vars({
    /* Primary brand colors */
    "--color-primary": "28 93 133", // #1C5D85
    "--color-secondary": "28 93 125", // #1C5D7D
    "--color-tertiary": "42 77 109", // #2a4d6d

    /* Text colors for different contexts */
    "--color-typography": "28 93 133", // Primary text color
    "--color-typography-secondary": "100 116 139", // Secondary/muted text
    "--color-typography-contrast": "255 255 255", // Text on dark backgrounds
    "--color-typography-accent": "28 93 133", // Accent text color
    "--color-typography-info": "30 64 175", // Info text color (blue-700)
    "--color-typography-info-emphasis": "29 78 216", // Info emphasis text (blue-800)

    /* Surface colors for different elevation levels */
    "--color-background": "245 247 250", // Main app background
    "--color-background-secondary": "255 255 255", // Card/container backgrounds
    "--color-background-elevated": "28 93 133", // Headers, elevated surfaces
    "--color-background-interactive": "245 247 250", // Hover/active states

    /* Border and outline colors */
    "--color-outline": "226 232 240", // Default borders, dividers
    "--color-outline-accent": "28 93 133", // Focused/active borders
    "--color-border-subtle": "229 231 235", // Subtle borders (gray-200)
    "--color-border-primary": "156 163 175", // Primary borders (gray-400)

    /* Surface interaction colors */
    "--color-surface-hover": "249 250 251", // Hover state background (gray-50)
    "--color-surface-active": "243 244 246", // Active/pressed state background (gray-100)

    /* Accent colors for highlights and CTAs */
    "--color-accent-primary": "28 93 125", // Primary accent color
    "--color-accent-secondary": "42 77 109", // Secondary accent color
    "--color-accent-info": "29 78 216", // Info accent color (blue-600)

    /* Status colors for user feedback */
    "--color-error": "220 38 38", // Error text and icons
    "--color-success": "22 163 74", // Success text and icons
    "--color-warning": "217 119 6", // Warning text and icons
    "--color-info": "37 99 235", // Info text and icons

    /* Background colors for status alerts and notifications */
    "--color-background-error": "254 226 226", // Light red background for error states
    "--color-background-success": "220 252 231", // Light green background for success states
    "--color-background-warning": "254 243 199", // Light yellow background for warnings
    "--color-background-info": "219 234 254", // Light blue background for info states
    "--color-background-info-emphasis": "147 197 253", // Emphasized blue background (blue-300)
    "--color-background-loading": "243 244 246", // Neutral background for loading states
    "--color-background-muted": "243 244 246", // Subtle background for muted content

    /* Border colors for status components */
    "--color-border-error": "239 68 68", // Red borders for error components
    "--color-border-success": "34 197 94", // Green borders for success components
    "--color-border-warning": "245 158 11", // Orange borders for warning components
    "--color-border-info": "59 130 246", // Blue borders for info components
    "--color-border-loading": "156 163 175", // Gray borders for loading components

    /* Text colors for loading states */
    "--color-foreground-loading": "107 114 128", // Muted text for loading content

    /* Focus ring colors for accessibility */
    "--color-indicator-primary": "28 93 133", // Primary focus ring
    "--color-indicator-info": "37 99 235", // Info focus ring
    "--color-indicator-error": "220 38 38", // Error focus ring

    /* Gradient color stops for background effects */
    "--gradient-primary-start": "28 93 133", // Primary gradient start
    "--gradient-primary-end": "42 77 109", // Primary gradient end
    "--gradient-accent-start": "28 93 125", // Accent gradient start
    "--gradient-accent-end": "28 93 133", // Accent gradient end
    "--gradient-background-start": "245 247 250", // Background gradient start
    "--gradient-background-end": "240 244 248", // Background gradient end
  }),
  dark: vars({
    /* Primary brand colors for dark theme */
    "--color-primary": "230 196 105", // Golden primary color
    "--color-secondary": "212 186 118", // Muted golden secondary
    "--color-tertiary": "57 62 70", // Dark blue-gray tertiary

    /* Text colors for dark theme readability */
    "--color-typography": "230 196 105", // Primary text (golden)
    "--color-typography-secondary": "227 226 206", // Muted text (off-white)
    "--color-typography-contrast": "255 255 255", // High contrast text
    "--color-typography-accent": "230 196 105", // Accent text (golden)
    "--color-typography-info": "147 197 253", // Info text color (blue-300)
    "--color-typography-info-emphasis": "191 219 254", // Info emphasis text (blue-200)

    /* Dark theme surface colors */
    "--color-background": "34 40 49", // Main dark background
    "--color-background-secondary": "57 62 70", // Elevated dark surfaces
    "--color-background-elevated": "57 62 70", // Cards, modals
    "--color-background-interactive": "34 40 49", // Hover/active states

    /* Dark theme borders */
    "--color-outline": "255 255 255 10", // Subtle white borders (10% opacity)
    "--color-outline-accent": "230 196 105", // Golden accent borders
    "--color-border-subtle": "55 65 81", // Subtle borders (gray-700)
    "--color-border-primary": "75 85 99", // Primary borders (gray-600)

    /* Dark theme surface interaction colors */
    "--color-surface-hover": "55 65 81", // Hover state background (gray-700)
    "--color-surface-active": "75 85 99", // Active/pressed state background (gray-600)

    /* Dark theme accent colors */
    "--color-accent-primary": "230 196 105", // Primary golden accent
    "--color-accent-secondary": "212 186 118", // Secondary golden accent
    "--color-accent-info": "147 197 253", // Info accent color (blue-300)

    /* Dark theme status colors */
    "--color-error": "252 165 165", // Light red for dark backgrounds
    "--color-success": "134 239 172", // Light green for dark backgrounds
    "--color-warning": "252 211 77", // Light yellow for dark backgrounds
    "--color-info": "147 197 253", // Light blue for dark backgrounds

    /* Dark theme status background colors */
    "--color-background-error": "127 29 29", // Dark red background for error states
    "--color-background-success": "20 83 45", // Dark green background for success states
    "--color-background-warning": "120 53 15", // Dark orange background for warnings
    "--color-background-info": "30 58 138", // Dark blue background for info states
    "--color-background-info-emphasis": "37 99 235", // Emphasized dark blue background (blue-600)
    "--color-background-loading": "31 41 55", // Dark neutral background for loading
    "--color-background-muted": "31 41 55", // Dark muted background

    /* Dark theme status border colors */
    "--color-border-error": "239 68 68", // Error component borders
    "--color-border-success": "34 197 94", // Success component borders
    "--color-border-warning": "245 158 11", // Warning component borders
    "--color-border-info": "59 130 246", // Info component borders
    "--color-border-loading": "75 85 99", // Loading component borders

    /* Dark theme loading text */
    "--color-foreground-loading": "209 213 219", // Light text for loading states

    /* Dark theme focus indicators */
    "--color-indicator-primary": "230 196 105", // Golden primary focus ring
    "--color-indicator-info": "147 197 253", // Blue info focus ring
    "--color-indicator-error": "252 165 165", // Red error focus ring

    /* Dark theme gradient color stops */
    "--gradient-primary-start": "230 196 105", // Golden gradient start
    "--gradient-primary-end": "212 186 118", // Golden gradient end
    "--gradient-accent-start": "230 196 105", // Accent gradient start
    "--gradient-accent-end": "212 186 118", // Accent gradient end
    "--gradient-background-start": "34 40 49", // Dark background gradient start
    "--gradient-background-end": "42 48 57", // Dark background gradient end
  }),
};
