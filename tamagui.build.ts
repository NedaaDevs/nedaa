import type { TamaguiBuildOptions } from "tamagui";

export default {
  config: "./tamagui.config.ts",
  components: ["tamagui"],
  disableExtraction: process.env.NODE_ENV === "development",
} satisfies TamaguiBuildOptions;
