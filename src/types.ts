export type DogRow = {
  rowNumber: number;
  paid?: string;
  timestamp?: string;
  email?: string;
  clientName?: string;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  dogName?: string;
  dogAge?: string;
  dogBreed?: string;
  goals?: string;
  issues?: string;
  status?: string;
  draftId?: string;
  printDocUrl?: string;
  confirmedDates?: string;
  emergencyContact?: string;
  feedingSchedule?: string;
  mealsPacked?: string;
  alteredStatus?: string;
  heatCyclePlan?: string;
  bathRequest?: string;
  shampooAllergies?: string;
  dogWeight?: string;
  rabiesStatus?: string;
  dogReadiness?: string;
  optionalAdventures?: string;
  etaAgreement?: string;
  extraNotes?: string;
  trainingDetails?: string;
};

export type PreviewResult = {
  title: string;
  rows: DogRow[];
  skipped: Array<{ rowNumber: number; reason: string }>;
  warnings?: {
    multiDogRows?: Array<{ rowNumber: number; dogName: string; reason: string }>;
    trainingRows?: Array<{ rowNumber: number; dogName: string; detail: string }>;
  };
};

export type SheetHeaderInfo = {
  sheetTitle: string;
  header: string[];
};

export type RunResult = {
  printDocTitle?: string;
  printDocId?: string;
  printDocUrl?: string;
  processed: Array<{
    rowNumber: number;
    dogName: string;
    email: string;
    draftId?: string;
    printDocUrl?: string;
    status: string;
    totalInvoice?: number;
    addOnsSummary?: string;
  }>;
  skipped: Array<{ rowNumber: number; reason: string }>;
  warnings?: {
    multiDogRows?: Array<{ rowNumber: number; dogName: string; reason: string }>;
    trainingRows?: Array<{ rowNumber: number; dogName: string; detail: string }>;
  };
  summary?: {
    processedCount: number;
    skippedCount: number;
    alreadyCompletedCount: number;
    duplicateProtectedCount: number;
  };
};
