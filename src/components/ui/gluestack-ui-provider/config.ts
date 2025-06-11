"use client";
import { vars } from "nativewind";

export const config = {
  light: vars({
    "--color-primary": "30 60 90", // #1e3c5a
    "--color-secondary": "42 77 109", // #2a4d6d
    "--color-tertiary": "61 93 125", // #3d5d7d
    "--color-error": "220 38 38", // #DC2626
    "--color-success": "22 163 74", // #16A34A
    "--color-warning": "217 119 6", // #D97706
    "--color-info": "37 99 235", // #2563EB

    /* Typography */
    "--color-typography": "26 26 26", // #1A1A1A

    /* Outline */
    "--color-outline": "226 232 240", // #E2E8F0

    /* Background */
    "--color-background": "245 247 250", // #F5F7FA

    /* Background Special */
    "--color-background-error": "254 226 226", // #FEE2E2
    "--color-background-warning": "254 243 199", // #FEF3C7
    "--color-background-success": "220 252 231", // #DCFCE7
    "--color-background-muted": "243 244 246", // #F3F4F6
    "--color-background-info": "219 234 254", // #DBEAFE

    /* Focus Ring Indicator */
    "--color-indicator-primary": "30 60 90", // #1e3c5a
    "--color-indicator-info": "37 99 235", // #2563EB
    "--color-indicator-error": "220 38 38", // #DC2626
  }),
  dark: vars({
    "--color-primary": "30 60 90", // #1e3c5a
    "--color-secondary": "42 77 109", // #2a4d6d
    "--color-tertiary": "61 93 125", // #3d5d7d
    "--color-error": "127 29 29", // #7F1D1D
    "--color-success": "20 83 45", // #14532D
    "--color-warning": "120 53 15", // #78350F
    "--color-info": "30 58 138", // #1E3A8A

    /* Typography */
    "--color-typography": "229 203 135", // #e5cb87

    /* Outline */
    "--color-outline": "255 255 255 0.1", // rgba(255,255,255,0.1)

    /* Background */
    "--color-background": "30 60 90", // #1e3c5a

    /* Background Special */
    "--color-background-error": "127 29 29", // #7F1D1D
    "--color-background-warning": "120 53 15", // #78350F
    "--color-background-success": "20 83 45", // #14532D
    "--color-background-muted": "31 41 55", // #1F2937
    "--color-background-info": "30 58 138", // #1E3A8A

    /* Focus Ring Indicator */
    "--color-indicator-primary": "229 203 135", // #e5cb87
    "--color-indicator-info": "147 197 253", // #93C5FD
    "--color-indicator-error": "252 165 165", // #FCA5A5
  }),
};
