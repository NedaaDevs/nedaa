import gluestackPlugin from "@gluestack-ui/nativewind-utils/tailwind-plugin";
import fontPlugin from "./src/plugins/fontPlugin";

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : "media",
  content: ["./src/app/**/*.{tsx,jsx,ts,js}", "./src/components/**/*.{tsx,jsx,ts,js}"],
  presets: [require("nativewind/preset")],
  safelist: [
    {
      pattern:
        /(bg|border|text|stroke|fill)-(primary|secondary|tertiary|error|success|warning|info|info-emphasis|typography|outline|background|indicator|accent)/,
    },
    {
      pattern: /(text)-(typography)-(secondary|contrast|accent)/,
    },
    {
      pattern:
        /(bg)-(background)-(secondary|elevated|interactive|loading|error|success|warning|info)/,
    },
    {
      pattern: /(bg)-(outline|outline-accent|accent)-(primary|secondary)?/,
    },
    {
      pattern: /(border)-(outline|outline-accent|error|success|warning|info|loading)/,
    },
    {
      pattern: /(text)-(foreground-loading)/,
    },
    {
      pattern: /(bg)-(gradient)-(primary|accent|background)/,
    },
    {
      pattern: /(from|to)-(gradient)-(primary|accent|background)-(start|end)/,
    },
    "font-regular",
    "font-medium",
    "font-semibold",
    "font-bold",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary)/<alpha-value>)",
        secondary: "rgb(var(--color-secondary)/<alpha-value>)",
        tertiary: "rgb(var(--color-tertiary)/<alpha-value>)",
        error: "rgb(var(--color-error)/<alpha-value>)",
        success: "rgb(var(--color-success)/<alpha-value>)",
        warning: "rgb(var(--color-warning)/<alpha-value>)",
        info: "rgb(var(--color-typography-info)/\u003calpha-value\u003e)",
        "info-emphasis": "rgb(var(--color-typography-info-emphasis)/\u003calpha-value\u003e)",
        "info-status": "rgb(var(--color-info)/\u003calpha-value\u003e)",
        typography: {
          DEFAULT: "rgb(var(--color-typography)/<alpha-value>)",
          secondary: "rgb(var(--color-typography-secondary)/<alpha-value>)",
          contrast: "rgb(var(--color-typography-contrast)/<alpha-value>)",
          accent: "rgb(var(--color-typography-accent)/<alpha-value>)",
          info: "rgb(var(--color-typography-info)/<alpha-value>)",
          "info-emphasis": "rgb(var(--color-typography-info-emphasis)/<alpha-value>)",
        },
        outline: {
          DEFAULT: "rgb(var(--color-outline)/<alpha-value>)",
          accent: "rgb(var(--color-outline-accent)/<alpha-value>)",
          // For dark mode rgba outline with 0.1 opacity
          muted: "rgba(255, 255, 255, 0.1)",
        },
        background: {
          DEFAULT: "rgb(var(--color-background)/<alpha-value>)",
          secondary: "rgb(var(--color-background-secondary)/<alpha-value>)",
          elevated: "rgb(var(--color-background-elevated)/<alpha-value>)",
          interactive: "rgb(var(--color-background-interactive)/<alpha-value>)",
          error: "rgb(var(--color-background-error)/<alpha-value>)",
          warning: "rgb(var(--color-background-warning)/<alpha-value>)",
          muted: "rgb(var(--color-background-muted)/<alpha-value>)",
          success: "rgb(var(--color-background-success)/<alpha-value>)",
          info: "rgb(var(--color-background-info)/<alpha-value>)",
          "info-emphasis": "rgb(var(--color-background-info-emphasis)/<alpha-value>)",
          loading: "rgb(var(--color-background-loading)/<alpha-value>)",
        },
        border: {
          error: "rgb(var(--color-border-error)/<alpha-value>)",
          success: "rgb(var(--color-border-success)/<alpha-value>)",
          warning: "rgb(var(--color-border-warning)/<alpha-value>)",
          info: "rgb(var(--color-border-info)/<alpha-value>)",
          loading: "rgb(var(--color-border-loading)/<alpha-value>)",
          subtle: "rgb(var(--color-border-subtle)/<alpha-value>)",
          primary: "rgb(var(--color-border-primary)/<alpha-value>)",
        },
        foreground: {
          loading: "rgb(var(--color-foreground-loading)/<alpha-value>)",
        },
        indicator: {
          primary: "rgb(var(--color-indicator-primary)/<alpha-value>)",
          info: "rgb(var(--color-indicator-info)/<alpha-value>)",
          error: "rgb(var(--color-indicator-error)/<alpha-value>)",
        },
        // Accent colors for highlights and calls-to-action
        accent: {
          primary: "rgb(var(--color-accent-primary)/\u003calpha-value\u003e)",
          secondary: "rgb(var(--color-accent-secondary)/\u003calpha-value\u003e)",
          info: "rgb(var(--color-accent-info)/\u003calpha-value\u003e)",
        },
        surface: {
          hover: "rgb(var(--color-surface-hover)/\u003calpha-value\u003e)",
          active: "rgb(var(--color-surface-active)/\u003calpha-value\u003e)",
        },
        // Gradient colors for linear gradient utilities
        "gradient-primary": {
          start: "rgb(var(--gradient-primary-start))",
          end: "rgb(var(--gradient-primary-end))",
        },
        "gradient-accent": {
          start: "rgb(var(--gradient-accent-start))",
          end: "rgb(var(--gradient-accent-end))",
        },
        "gradient-background": {
          start: "rgb(var(--gradient-background-start))",
          end: "rgb(var(--gradient-background-end))",
        },
      },
      fontFamily: {
        "asap-regular": "Asap-Regular",
        "asap-medium": "Asap-Medium",
        "asap-bold": "Asap-Bold",
        "asap-semibold": "Asap-SemiBold",
        "ibm-plex-sans-regular": "IBMPlexSans-Regular",
        "ibm-plex-sans-semibold": "IBMPlexSans-SemiBold",
        "ibm-plex-sans-medium": "IBMPlexSans-Regular",
        "ibm-plex-sans-bold": "IBMPlexSans-Bold",
      },
      fontWeight: {
        extrablack: "950",
      },
      fontSize: {
        "2xs": "10px",
      },
      backgroundImage: {
        // Predefined gradient backgrounds using theme color variables
        "gradient-primary":
          "linear-gradient(to right, rgb(var(--gradient-primary-start)), rgb(var(--gradient-primary-end)))",
        "gradient-accent":
          "linear-gradient(to right, rgb(var(--gradient-accent-start)), rgb(var(--gradient-accent-end)))",
        "gradient-background":
          "linear-gradient(to bottom, rgb(var(--gradient-background-start)), rgb(var(--gradient-background-end)))",
        "radial-primary":
          "radial-gradient(circle at center, rgb(var(--gradient-primary-start)), rgb(var(--gradient-primary-end)))",
        "radial-accent":
          "radial-gradient(circle at center, rgb(var(--gradient-accent-start)), rgb(var(--gradient-accent-end)))",
        "radial-background":
          "radial-gradient(circle at center, rgb(var(--gradient-background-start)), rgb(var(--gradient-background-end)))",
      },
      boxShadow: {
        "hard-1": "-2px 2px 8px 0px rgba(38, 38, 38, 0.20)",
        "hard-2": "0px 3px 10px 0px rgba(38, 38, 38, 0.20)",
        "hard-3": "2px 2px 8px 0px rgba(38, 38, 38, 0.20)",
        "hard-4": "0px -3px 10px 0px rgba(38, 38, 38, 0.20)",
        "hard-5": "0px 2px 10px 0px rgba(38, 38, 38, 0.10)",
        "soft-1": "0px 0px 10px rgba(38, 38, 38, 0.1)",
        "soft-2": "0px 0px 20px rgba(38, 38, 38, 0.2)",
        "soft-3": "0px 0px 30px rgba(38, 38, 38, 0.1)",
        "soft-4": "0px 0px 40px rgba(38, 38, 38, 0.1)",
      },
    },
  },
  plugins: [gluestackPlugin, fontPlugin],
};
