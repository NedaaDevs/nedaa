import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

function load(file: string): Buffer {
  return readFileSync(path.join(dir, "fonts", file));
}

export type SatoriFont = {
  name: string;
  data: Buffer;
  weight: number;
  style: "normal";
};

export function fontsFor(locale: "en" | "ar"): SatoriFont[] {
  if (locale === "ar") {
    return [
      {
        name: "IBM Plex Sans Arabic",
        data: load("IBMPlexSansArabic-400.ttf"),
        weight: 400,
        style: "normal",
      },
      {
        name: "IBM Plex Sans Arabic",
        data: load("IBMPlexSansArabic-700.ttf"),
        weight: 700,
        style: "normal",
      },
    ];
  }
  return [
    { name: "Asap", data: load("Asap-400.ttf"), weight: 400, style: "normal" },
    { name: "Asap", data: load("Asap-700.ttf"), weight: 700, style: "normal" },
  ];
}
