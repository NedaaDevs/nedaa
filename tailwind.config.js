import gluestackPlugin from "@gluestack-ui/nativewind-utils/tailwind-plugin";

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : "media",
  content: ["./app/**/*.{tsx,jsx,ts,js}", "./components/**/*.{tsx,jsx,ts,js}"],
  presets: [require("nativewind/preset")],
  safelist: [
    {
      pattern:
        /(bg|border|text|stroke|fill)-(primary|secondary|tertiary|error|success|warning|info|typography|outline|background|indicator)/,
    },
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
        info: "rgb(var(--color-info)/<alpha-value>)",
        typography: {
          DEFAULT: "rgb(var(--color-typography)/<alpha-value>)",
          white: "#FFFFFF",
          gray: "#D4D4D4",
          black: "#181718",
        },
        outline: "rgb(var(--color-outline)/<alpha-value>)",
        background: {
          DEFAULT: "rgb(var(--color-background)/<alpha-value>)",
          light: "#FBFBFB",
          dark: "#181719",
          error: "rgb(var(--color-background-error)/<alpha-value>)",
          warning: "rgb(var(--color-background-warning)/<alpha-value>)",
          muted: "rgb(var(--color-background-muted)/<alpha-value>)",
          success: "rgb(var(--color-background-success)/<alpha-value>)",
          info: "rgb(var(--color-background-info)/<alpha-value>)",
        },
        indicator: {
          primary: "rgb(var(--color-indicator-primary)/<alpha-value>)",
          info: "rgb(var(--color-indicator-info)/<alpha-value>)",
          error: "rgb(var(--color-indicator-error)/<alpha-value>)",
        },
      },
      fontFamily: {
        heading: undefined,
        body: undefined,
        mono: undefined,
        roboto: ["Roboto", "sans-serif"],
      },
      fontWeight: {
        extrablack: "950",
      },
      fontSize: {
        "2xs": "10px",
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
  plugins: [gluestackPlugin],
};
