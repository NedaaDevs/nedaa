"use client";
import { vars } from "nativewind";

export const config = {
  light: vars({
    "--color-primary": "59 130 246", // #3b82f6
    "--color-secondary": "234 179 8", // #eab308
    "--color-tertiary": "191 196 205", //  #f3f4f6
    "--color-error": "239 68 68", // #ef4444
    "--color-success": "52 131 82", // green shade
    "--color-warning": "231 120 40", // orange shade
    "--color-info": "13 166 242", // blue shade

    /* Typography */
    "--color-typography": "140 140 140",

    /* Outline */
    "--color-outline": "140 141 141",

    /* Background */
    "--color-background": "142 142 142",

    /* Background Special */
    "--color-background-error": "254 241 241",
    "--color-background-warning": "255 243 234",
    "--color-background-success": "237 252 242",
    "--color-background-muted": "247 248 247",
    "--color-background-info": "235 248 254",

    /* Focus Ring Indicator  */
    "--color-indicator-primary": "55 55 55",
    "--color-indicator-info": "83 153 236",
    "--color-indicator-error": "185 28 28",
  }),
  dark: vars({
    "--color-primary": "59 130 246", // #3b82f6
    "--color-secondary": "234 179 8", // #eab308
    "--color-tertiary": "75 85 99", // lighter version of #1f2937
    "--color-error": "239 68 68", // #ef4444
    "--color-success": "72 151 102", // green shade
    "--color-warning": "251 149 75", // orange shade
    "--color-info": "50 180 244", // blue shade

    /* Typography */
    "--color-typography": "163 163 163",

    /* Outline */
    "--color-outline": "165 163 163",

    /* Background */
    "--color-background": "86 96 110", // lighter version of #1f2937

    /* Background Special */
    "--color-background-error": "66 43 43",
    "--color-background-warning": "65 47 35",
    "--color-background-success": "28 43 33",
    "--color-background-muted": "51 51 51",
    "--color-background-info": "26 40 46",

    /* Focus Ring Indicator  */
    "--color-indicator-primary": "247 247 247",
    "--color-indicator-info": "161 199 245",
    "--color-indicator-error": "232 70 69",
  }),
};
