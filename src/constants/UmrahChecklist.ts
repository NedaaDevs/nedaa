import type { PreChecklistItem } from "@/types/umrah";

export const PRE_UMRAH_CHECKLIST: PreChecklistItem[] = [
  { id: "nusuk-permit", titleKey: "umrah.prepare.checklist.nusukPermit" },
  { id: "rest-well", titleKey: "umrah.prepare.checklist.restWell" },
  { id: "medications", titleKey: "umrah.prepare.checklist.medications" },
  { id: "emergency-meds", titleKey: "umrah.prepare.checklist.emergencyMeds" },
  { id: "comfortable-shoes", titleKey: "umrah.prepare.checklist.comfortableShoes" },
  { id: "id-documents", titleKey: "umrah.prepare.checklist.idDocuments" },
  { id: "phone-charged", titleKey: "umrah.prepare.checklist.phoneCharged" },
  { id: "water-bottle", titleKey: "umrah.prepare.checklist.waterBottle" },
];

const MINISTRY_BASE = "https://haj.gov.sa";
const MINISTRY_PATH = "/Awareness-Center/Awareness-Guides";

const MINISTRY_LOCALE_PREFIX: Record<string, string> = {
  ar: "/ar",
  en: "/en",
  ms: "/ms",
  ur: "/ur",
};

export const getMinistryLink = (locale: string): string => {
  const prefix = MINISTRY_LOCALE_PREFIX[locale] ?? "/en";
  return `${MINISTRY_BASE}${prefix}${MINISTRY_PATH}`;
};

export const MINISTRY_LINK = `${MINISTRY_BASE}${MINISTRY_PATH}`;
