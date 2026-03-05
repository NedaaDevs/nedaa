export type DuaContent = {
  id: string;
  arabic: string;
  transliteration: Record<string, string>;
  translation: Record<string, string>;
  audioKey?: string;
  source: string;
};

export type SubStepType = "instruction" | "dua" | "checklist" | "lap";

export type SubStep = {
  id: string;
  type: SubStepType;
  titleKey: string;
  descriptionKey?: string;
  dua?: DuaContent;
  checklistItems?: string[];
  lapNumber?: number;
  lapDirection?: "safaToMarwa" | "marwaToSafa";
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
