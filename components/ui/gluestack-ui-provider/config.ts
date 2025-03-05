"use client";
import { vars } from "nativewind";

export const config = {
  light: vars({
    "--color-primary": "59 130 246", // #3b82f6
    "--color-secondary": "229 203 135", // #e5cb87
    "--color-tertiary": "191 196 205", // #bfc4cd
    "--color-error": "239 68 68", // #ef4444
    "--color-success": "52 131 82", // #348352
    "--color-warning": "231 120 40", // #e77828
    "--color-info": "13 166 242", // #0da6f2

    /* Typography */
    "--color-typography": "140 140 140", // #8c8c8c

    /* Outline */
    "--color-outline": "140 141 141", // #8c8d8d

    /* Background */
    "--color-background": "10 26 43", // #0a1a2b

    /* Background Special */
    "--color-background-error": "254 241 241", // #fef1f1
    "--color-background-warning": "255 243 234", // #fff3ea
    "--color-background-success": "237 252 242", // #edfcf2
    "--color-background-muted": "247 248 247", // #f7f8f7
    "--color-background-info": "235 248 254", // #ebf8fe

    /* Focus Ring Indicator */
    "--color-indicator-primary": "55 55 55", // #373737
    "--color-indicator-info": "83 153 236", // #5399ec
    "--color-indicator-error": "185 28 28", // #b91c1c
  }),
  dark: vars({
    "--color-primary": "59 130 246", // #3b82f6
    "--color-secondary": "229 203 135", // #e5cb87
    "--color-tertiary": "75 85 99", // #4b5563
    "--color-error": "239 68 68", // #ef4444
    "--color-success": "72 151 102", // #489766
    "--color-warning": "251 149 75", // #fb954b
    "--color-info": "50 180 244", // #32b4f4

    /* Typography */
    "--color-typography": "163 163 163", // #a3a3a3

    /* Outline */
    "--color-outline": "165 163 163", // #a5a3a3

    /* Background */
    "--color-background": "10 26 43", // #0a1a2b

    /* Background Special */
    "--color-background-error": "66 43 43", // #422b2b
    "--color-background-warning": "65 47 35", // #412f23
    "--color-background-success": "28 43 33", // #1c2b21
    "--color-background-muted": "51 51 51", // #333333
    "--color-background-info": "26 40 46", // #1a282e

    /* Focus Ring Indicator */
    "--color-indicator-primary": "247 247 247", // #f7f7f7
    "--color-indicator-info": "161 199 245", // #a1c7f5
    "--color-indicator-error": "232 70 69", // #e84645
  }),
};
