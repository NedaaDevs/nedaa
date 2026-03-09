export type DuaContent = {
  id: string;
  arabic: string;
  transliteration: Record<string, string>;
  translation: Record<string, string>;
  audioKey?: string;
  source: string;
  hadithSource?: string;
  hadithTranslation?: string;
  repeatCount?: number;
};

export type SubStepType = "instruction" | "dua" | "checklist" | "lap" | "reference";

export type SubStep = {
  id: string;
  type: SubStepType;
  titleKey: string;
  descriptionKey?: string;
  dua?: DuaContent;
  checklistItems?: string[];
  lapNumber?: number;
  lapDirection?: "safaToMarwa" | "marwaToSafa";
  route?: string;
};

export type StageId = "ihram" | "tawaf" | "sai" | "tahallul";

export type Stage = {
  id: StageId;
  titleKey: string;
  subtitleKey: string;
  iconName: string;
  steps: SubStep[];
};

export type UmrahRecord = {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  hijriDate: string;
  gregorianDate: string;
};

export type ActiveProgress = {
  currentStageIndex: number;
  currentStepIndex: number;
  completedStages: StageId[];
  checklistState: Record<string, boolean>;
  startedAt: string;
  updatedAt: string;
};

export type Gender = "male" | "female";

export type MiqatId =
  | "dhul-hulayfah"
  | "juhfah"
  | "yalamlam"
  | "qarn-al-manazil"
  | "dhat-irq"
  | "tanim";

export type MiqatPoint = {
  id: MiqatId;
  nameAr: string;
  nameEn: string;
  alternateNameAr?: string;
  alternateNameEn?: string;
  distanceFromMakkahKm: number;
  fromDirections: string[];
  isInsideMakkah: boolean;
};

export type IhramProhibition = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  appliesTo: "men" | "women" | "both";
  icon: string;
};

export type PreChecklistItem = {
  id: string;
  titleKey: string;
};
